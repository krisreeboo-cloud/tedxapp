const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // CORS headers (adjust origin for production if needed)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    try {
        const { googleAccessToken } = JSON.parse(event.body);

        if (!googleAccessToken) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing Google access token' }) };
        }

        // 1. Verify the Google token server-side by fetching user info
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${googleAccessToken}` },
        });

        if (!googleRes.ok) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid Google token' }) };
        }

        const googleUser = await googleRes.json();
        const email = (googleUser.email || '').toLowerCase().trim();
        const name = googleUser.name || '';

        // 2. Domain check
        const ALLOWED_DOMAIN = 'goa.bits-pilani.ac.in';
        if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: `Only @${ALLOWED_DOMAIN} emails are allowed.` }),
            };
        }

        // 3. Query Supabase with the secret service_role key
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: record, error } = await supabase
            .from('students')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !record) {
            // Valid BITS student but not in the purchase database
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    found: false,
                    user: { email, name, id: null, tc: '', sapphire: '', theme: '', combo1: '', combo2: '' },
                }),
            };
        }

        // 4. Return only this student's record
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                found: true,
                user: { email, ...record },
            }),
        };
    } catch (err) {
        console.error('get-ticket error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};
