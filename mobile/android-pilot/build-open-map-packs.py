"""Build a bounded, licensed Davao de Oro raster pack from source data, never public tile scraping.
The review build must fail if the real data cannot be obtained or verified.
Street source: OSM Overpass data, ODbL 1.0. Imagery: Copernicus Sentinel-2 L2A visual COGs, Earth Search.
"""
import hashlib
import json
import math
import pathlib
import sys

ROOT = pathlib.Path("mobile/android-pilot/build/web/bundled-maps")
LIMIT = 180 * 1024 * 1024
BBOX = (125.65, 7.05, 126.32, 8.02)
VERSION = "2025-review-v1"


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


# One region-bounded vector data query; no public map tile server requests.
w,s,e,n=BBOX
query=f'[out:json][timeout:90];(way["highway"]({s},{w},{n},{e});way["waterway"~"river|stream"]({s},{w},{n},{e});node["place"~"city|town|village"]({s},{w},{n},{e}););out geom;'
osm=request_json("https://overpass-api.de/api/interpreter",params={"data":query},timeout=115)
if osm.get("remark") or not isinstance(osm.get("elements"),list):
    raise RuntimeError("OSM extraction incomplete")
roads=[a for a in osm["elements"] if a.get("type")=="way" and a.get("tags",{}).get("highway") and len(a.get("geometry",[]))>=2]
water=[a for a in osm["elements"] if a.get("type")=="way" and a.get("tags",{}).get("waterway") and len(a.get("geometry",[]))>=2]
places=[a for a in osm["elements"] if a.get("type")=="node" and a.get("tags",{}).get("name") and a.get("tags",{}).get("place")]
assert len(roads)>200 and places, "Unexpectedly sparse road extract"
print("OSM source",len(roads),"road ways and",len(places),"settlements",flush=True)
osm_date=osm.get("osm3s",{}).get("timestamp_osm_base","unknown")
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

street_pack=write_tiles("ddo-streets","Davao de Oro roads (offline)","© OpenStreetMap contributors — ODbL 1.0; openstreetmap.org/copyright",14,streets,{"date":osm_date,"source":"https://overpass-api.de","bbox":BBOX})

# Use a low-cloud L2A RGB product mosaic, not imagery from an unlicensed commercial tile layer.
# The native satellite zoom is 13 (~19 m pixels at the equator).
z=13
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
    canvas=Image.new("RGB",(ww*scale,hh*scale),"#ebebeb")
    canvas.paste(rgb,(-crop[0],-crop[1]))
    return canvas.resize((ww,hh),Image.Resampling.LANCZOS)

sat_pack=write_tiles("ddo-sentinel","Sentinel-2 satellite (2025, offline)","Contains modified Copernicus Sentinel data (2025), Earth Search; 19 m overview",13,satellite,{"scenes":provenance,"coverage_fraction":coverage,"bbox":BBOX})
manifest={"packs":[street_pack,sat_pack]}
(ROOT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
verify()
