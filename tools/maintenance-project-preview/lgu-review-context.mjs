// Server-owned preview configuration, never accepted from query/body data.
// This is a review-role simulation, not production authentication.
export function createLguReviewContext(env = process.env) {
    const actor = { account_type: env.JAIROADS_LGU_REVIEW_ROLE ?? 'Admin' };
    const relationships = { roadCoverages: [], engineerLgus: [], engineers: [] };
    if (env.JAIROADS_LGU_REVIEW_SCENARIO === 'dependencies') {
        relationships.fixture_notice = 'Development dependency fixtures are enabled for LGU deletion review. These are not actual LGU records.';
        relationships.roadCoverages.push(
            { id: 9001, lgus_id: 1, road_name: 'Development fixture — coverage A', kilometers: '2.50', pavement_type: 'Concrete', state_category: 'Good' },
            { id: 9002, lgus_id: 1, road_name: 'Development fixture — coverage B', kilometers: '1.20', pavement_type: 'Gravel', state_category: 'Fair' },
        );
        relationships.engineers.push(
            { id: 9001, first_name: 'Development', last_name: 'Engineer A', rank: 'Engineer II' },
            { id: 9002, first_name: 'Development', last_name: 'Engineer B', rank: 'Engineer I' },
        );
        relationships.engineerLgus.push(
            { engineer_id: 9001, lgus_id: 1, is_active: true },
            { engineer_id: 9002, lgus_id: 1, is_active: false },
        );
    }
    return { actor, relationships };
}
