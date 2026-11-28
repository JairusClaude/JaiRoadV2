"""Build a bounded, licensed Davao de Oro raster pack from source data, never public tile scraping.
The review build must fail if the real data cannot be obtained or verified.
Street source: OpenStreetMap France regional PBF, ODbL 1.0. Imagery: Copernicus Sentinel-2 L2A visual COGs, Earth Search.
"""
import hashlib
import json
import math
import pathlib
import sys

ROOT = pathlib.Path("mobile/android-pilot/build/web/bundled-maps")
LIMIT = 180 * 1024 * 1024
BBOX = (125.65, 7.05, 126.32, 8.02)
VERSION = "2025-review-v2"


def verify():
    data = json.loads((ROOT / "manifest.json").read_text())
    assert {p["id"] for p in data["packs"]} == {"ddo-streets", "ddo-sentinel"}
    total = 0
    for pack in data["packs"]:
        assert pack["tiles"] and pack["attribution"]
        for tile in pack["tiles"]:
            path = ROOT / pack["id"] / pack["version"] / str(tile["z"]) / str(tile["x"]) / (str(tile["y"]) + "." + pack["format"])
            raw = path.read_bytes()
            assert len(raw) == tile["bytes"] and hashlib.sha256(raw).hexdigest() == tile["sha256"]
            total += len(raw)
    network = data["network"]
    network_bytes = (ROOT / "road-network.json").read_bytes()
    assert len(network_bytes) == network["bytes"] and hashlib.sha256(network_bytes).hexdigest() == network["sha256"]
    graph = json.loads(network_bytes)
    assert len(graph["points"]) > 1000 and len(graph["edges"]) > 1000 and graph["places"]
    assert len(network_bytes) <= 48 * 1024 * 1024
    total += len(network_bytes)
    assert total <= LIMIT
    print("Verified", len(data["packs"]), "real data packs;", total, "bytes", flush=True)


if "--verify-only" in sys.argv:
    verify()
    raise SystemExit


import numpy as np
import requests
import rasterio
from PIL import Image, ImageDraw, ImageFont
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from shapely.geometry import box, shape
from urllib.parse import urlparse

session = requests.Session()
session.headers.update({"User-Agent": "JaiROADS-offline-review/1.0 (bounded public GIS source export)"})
WORLD = 20037508.342789244


def request_json(url, params=None, payload=None, max_bytes=50 * 1024 * 1024, timeout=120):
    with session.request("POST" if payload is not None else "GET", url, params=params, json=payload, timeout=(15, timeout), stream=True) as response:
        response.raise_for_status()
        data = bytearray()
        for block in response.iter_content(65536):
            data.extend(block)
            if len(data) > max_bytes:
                raise RuntimeError("Source response exceeded the download budget")
    return json.loads(data)


def tile_xy(lon, lat, z):
    n = 2**z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


def extent(z):
    w,s,e,n = BBOX
    x0,y0 = tile_xy(w,n,z)
    x1,y1 = tile_xy(e,s,z)
    return math.floor(x0), math.floor(y0), math.floor(x1), math.floor(y1)


def image_grid(z):
    x0,y0,x1,y1 = extent(z)
    return x0,y0,(x1-x0+1)*256,(y1-y0+1)*256


def write_tiles(pack_id, label, attribution, native_zoom, image_at_zoom, sources):
    pack = {"id":pack_id,"version":VERSION,"label":label,"attribution":attribution,"format":"jpg","minZoom":9,"maxZoom":native_zoom,"tiles":[],"sources":sources}
    for z in range(9,native_zoom+1):
        x0,y0,width,height=image_grid(z)
        image=image_at_zoom(z)
        assert image.size == (width,height), (z,image.size,width,height)
        for j in range(height//256):
            for i in range(width//256):
                x,y=x0+i,y0+j
                path=ROOT/pack_id/VERSION/str(z)/str(x)/(str(y)+".jpg")
                path.parent.mkdir(parents=True,exist_ok=True)
                image.crop((i*256,j*256,(i+1)*256,(j+1)*256)).convert("RGB").save(path,quality=83,optimize=True)
                data=path.read_bytes()
                pack["tiles"].append({"z":z,"x":x,"y":y,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
        print(pack_id,"zoom",z,"prepared",flush=True)
    return pack


# Use an official regional PBF dump instead of burdening a public Overpass instance.
# No personal contributor metadata, private system data or public map tiles are retained.
import osmium
from tempfile import TemporaryDirectory

w,s,e,n=BBOX
roads=[]
water=[]
places=[]
road_points={}
road_edges=set()
road_names={}
route_types={'motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','service','track','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link'}
source_url="https://download.openstreetmap.fr/extracts/asia/philippines/davao_region-latest.osm.pbf"

class RegionSource(osmium.SimpleHandler):
    def node(self,node):
        place=node.tags.get("place")
        name=node.tags.get("name")
        if place in ("city","town","village","hamlet","suburb","neighbourhood") and name and node.location.valid():
            lon,lat=node.location.lon,node.location.lat
            if w<=lon<=e and s<=lat<=n:
                places.append({"lat":lat,"lon":lon,"tags":{"place":place,"name":name}})

    def way(self,way):
        highway=way.tags.get("highway")
        waterway=way.tags.get("waterway")
        if not highway and waterway not in ("river","stream"):
            return
        points=[(node.lon,node.lat) for node in way.nodes if node.location.valid()]
        if len(points)<2:return
        xs,ys=zip(*points)
        if max(xs)<w or min(xs)>e or max(ys)<s or min(ys)>n:return
        item={"geometry":[{"lon":lon,"lat":lat} for lon,lat in points],"tags":{}}
        if highway:
            item["tags"]["highway"]=highway
            roads.append(item)
            name=way.tags.get("name")
            if name:
                for lon,lat in points:
                    if w<=lon<=e and s<=lat<=n:
                        road_names.setdefault(name,(round(lon,6),round(lat,6)))
                        break
            # Shared OSM node identities preserve actual road junction topology.
            # Undirected road geometry suggestions are not vehicle navigation.
            if highway in route_types and way.tags.get("access") not in ("private","no"):
                previous=None
                for node in way.nodes:
                    if not node.location.valid() or not (w<=node.lon<=e and s<=node.lat<=n):
                        previous=None
                        continue
                    ref=node.ref
                    road_points[ref]=(round(node.lon,6),round(node.lat,6))
                    if previous is not None and previous!=ref:
                        road_edges.add(tuple(sorted((previous,ref))))
                    previous=ref
        elif waterway:
            item["tags"]["waterway"]=waterway
            water.append(item)

with TemporaryDirectory() as temporary:
    pbf=pathlib.Path(temporary)/"region.osm.pbf"
    digest=hashlib.sha256()
    size=0
    with session.get(source_url,timeout=(20,120),stream=True) as response:
        response.raise_for_status()
        osm_date=response.headers.get("Last-Modified","unknown")
        with pbf.open("wb") as out:
            for chunk in response.iter_content(1024*1024):
                size+=len(chunk)
                if size>80*1024*1024:raise RuntimeError("Regional extract exceeds 80 MiB bound")
                digest.update(chunk);out.write(chunk)
    if size<1024*1024:raise RuntimeError("Regional PBF file unexpectedly small")
    RegionSource().apply_file(str(pbf),locations=True,idx="flex_mem")
    source_hash=digest.hexdigest()
assert len(roads)>200 and places,"Unexpectedly sparse regional road extract"
print("OSM regional source",len(roads),"roads,",len(places),"settlements,",size,"bytes",flush=True)
ROOT.mkdir(parents=True,exist_ok=True)
node_ids=sorted(road_points)
assert 1000 < len(node_ids) <= 650000 and 1000 < len(road_edges) <= 1000000
index={ref:i for i,ref in enumerate(node_ids)}
graph={"points":[road_points[ref] for ref in node_ids],
       "edges":[[index[a],index[b]] for a,b in sorted(road_edges)],
       "places":[{"name":p["tags"]["name"][:160],"point":[p["lon"],p["lat"]]} for p in places]+[{"name":name[:160],"point":point} for name,point in sorted(road_names.items())],
       "source":{"url":source_url,"date":osm_date,"sha256":source_hash,"license":"ODbL-1.0","attribution":"OpenStreetMap contributors","license_url":"https://www.openstreetmap.org/copyright"}}
network_bytes=json.dumps(graph,separators=(",",":"),ensure_ascii=False).encode()
assert len(network_bytes)<=48*1024*1024
(ROOT/"road-network.json").write_bytes(network_bytes)
network={"bytes":len(network_bytes),"sha256":hashlib.sha256(network_bytes).hexdigest()}
print("Offline road network",len(node_ids),"nodes,",len(road_edges),"edges,",len(graph["places"]),"searchable names",flush=True)
del graph,network_bytes,road_points,road_edges,index,node_ids,road_names
font_path="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
major={"motorway","trunk","primary","secondary"}
middle={"tertiary","unclassified","residential"}
def streets(z):
    x0,y0,width,height=image_grid(z)
    img=Image.new("RGB",(width,height),"#f2efe8")
    draw=ImageDraw.Draw(img)
    def point(lon,lat):
        x,y=tile_xy(lon,lat,z)
        return round((x-x0)*256),round((y-y0)*256)
    def line(way):
        return [point(p["lon"],p["lat"]) for p in way["geometry"] if "lon" in p and "lat" in p]
    for way in water:
        coords=line(way)
        if len(coords)>1:draw.line(coords,fill="#8cb9ce",width=1 if z<12 else 2)
    for group in [0,1,2]:
        for road in roads:
            kind=road["tags"]["highway"]
            level=2 if kind in major else 1 if kind in middle else 0
            if level!=group or (z<11 and level==0) or (z<10 and level==1):continue
            coords=line(road)
            if len(coords)<2:continue
            width=(1 if group==0 else 2 if group==1 else 3) + (1 if z>=13 else 0)
            draw.line(coords,fill="#d0c3ae" if group==0 else "#cbb79a",width=width+2)
            draw.line(coords,fill="#ffffff" if group<2 else "#e8ad56",width=width)
    font=ImageFont.truetype(font_path,14 if z>=12 else 11)
    occupied=[]
    for place in sorted(places,key=lambda p: {"city":0,"town":1,"village":2}.get(p["tags"]["place"],3)):
        if z<12 and place["tags"]["place"]=="village":continue
        x,y=point(place["lon"],place["lat"])
        label=place["tags"]["name"][:60]
        rect=draw.textbbox((x+4,y-8),label,font=font,stroke_width=1)
        if any(rect[0]<r[2] and rect[2]>r[0] and rect[1]<r[3] and rect[3]>r[1] for r in occupied):continue
        occupied.append(rect)
        draw.ellipse((x-2,y-2,x+2,y+2),fill="#6e6455")
        draw.text((x+4,y-8),label,fill="#463b2e",font=font,stroke_width=1,stroke_fill="#ffffff")
    return img

street_pack=write_tiles("ddo-streets","Davao de Oro roads (offline)","© OpenStreetMap contributors — ODbL 1.0; openstreetmap.org/copyright",15,streets,{"date":osm_date,"source":source_url,"source_sha256":source_hash,"bbox":BBOX})

# Use a low-cloud L2A RGB product mosaic, not imagery from an unlicensed commercial tile layer.
# Native zoom 14 (~9.55 m pixels at the equator; source resolution ~10 m).
z=14
x0,y0,width,height=image_grid(z)
pixel_size=2*WORLD/(2**z*256)
west=-WORLD+x0*256*pixel_size
north=WORLD-y0*256*pixel_size
east=west+width*pixel_size
south=north-height*pixel_size
transform=from_bounds(west,south,east,north,width,height)
target=box(*BBOX)
stac=request_json("https://earth-search.aws.element84.com/v1/search",payload={"collections":["sentinel-2-l2a"],"bbox":list(BBOX),"datetime":"2025-01-01T00:00:00Z/2025-12-31T23:59:59Z","limit":100,"query":{"eo:cloud_cover":{"lt":35}}},max_bytes=15*1024*1024)
candidates=[]
for item in stac.get("features",[]):
    asset=item.get("assets",{}).get("visual",{})
    href=asset.get("href","")
    parsed=urlparse(href)
    if parsed.scheme!="https" or not (parsed.hostname or "").endswith(".amazonaws.com") or not parsed.path.endswith(".tif"):continue
    footprint=shape(item["geometry"]).intersection(target)
    if not footprint.is_empty:candidates.append((item,href,footprint))
if not candidates:raise RuntimeError("No public Sentinel-2 visual COGs returned")
remaining=target
chosen=[]
while candidates and remaining.area>target.area*.005 and len(chosen)<8:
    best=max(candidates,key=lambda v: v[2].intersection(remaining).area/(1+float(v[0].get("properties",{}).get("eo:cloud_cover",35))/20))
    candidates.remove(best)
    if best[2].intersection(remaining).area<target.area*.0001:break
    chosen.append(best)
    remaining=remaining.difference(best[2])
if remaining.area>target.area*.03:raise RuntimeError("Insufficient Sentinel-2 footprint coverage")
canvas=np.full((3,height,width),235,dtype=np.uint8)
valid=np.zeros((height,width),dtype=bool)
provenance=[]
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",GDAL_HTTP_TIMEOUT="45",GDAL_HTTP_MAX_RETRY="1"):
    for item,href,_ in sorted(chosen,key=lambda v: v[0].get("properties",{}).get("eo:cloud_cover",100)):
        with rasterio.open(href) as source:
            assert source.count>=3 and source.dtypes[0]=="uint8","Expected RGB visual COG"
            with WarpedVRT(source,crs="EPSG:3857",transform=transform,width=width,height=height,resampling=Resampling.bilinear,src_nodata=0,nodata=0) as vrt:
                data=vrt.read([1,2,3],masked=True)
                present=~np.any(np.ma.getmaskarray(data),axis=0)
                keep=present&~valid
                canvas[:,keep]=data.data[:,keep]
                valid|=present
        provenance.append({"id":item["id"],"datetime":item["properties"]["datetime"],"cloud_cover":item["properties"].get("eo:cloud_cover"),"source":href})
        print("Sentinel scene",item["id"],"canvas coverage",round(float(valid.mean()),3),flush=True)
# Require meaningful actual satellite pixels throughout the requested region.
def pix(lon,lat):
    x,y=tile_xy(lon,lat,z)
    return int((x-x0)*256),int((y-y0)*256)
a,b=pix(w,n);c,d=pix(e,s)
coverage=float(valid[b:d,a:c].mean())
if coverage<.97:raise RuntimeError("Incomplete imagery: "+str(coverage))
rgb=Image.fromarray(canvas.transpose(1,2,0),"RGB")
def satellite(zoom):
    x,y,ww,hh=image_grid(zoom)
    scale=2**(z-zoom)
    crop=((x*scale-x0)*256,(y*scale-y0)*256,(x*scale-x0)*256+ww*scale,(y*scale-y0)*256+hh*scale)
    # Coarser tile edges outside the region are neutral no-data, not invented imagery.
    # Resample only the intersection, avoiding a giant coarse-zoom canvas.
    left,top,right,bottom=max(0,crop[0]),max(0,crop[1]),min(rgb.width,crop[2]),min(rgb.height,crop[3])
    output=Image.new("RGB",(ww,hh),"#ebebeb")
    if right>left and bottom>top:
        patch=rgb.crop((left,top,right,bottom)).resize((max(1,round((right-left)/scale)),max(1,round((bottom-top)/scale))),Image.Resampling.LANCZOS)
        output.paste(patch,(round((left-crop[0])/scale),round((top-crop[1])/scale)))
    return output

sat_pack=write_tiles("ddo-sentinel","Sentinel-2 satellite (2025, offline)","Contains modified Copernicus Sentinel data (2025), Earth Search; 10 m overview",14,satellite,{"scenes":provenance,"coverage_fraction":coverage,"bbox":BBOX})
manifest={"packs":[street_pack,sat_pack],"network":network}
(ROOT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
verify()
