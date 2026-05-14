import { fetchData } from "../AppUtils/dataAPI";


export const fetchCompanies = async () => {

    console.log('[API] fetchCompanies → GET /api/companies');

    try {

        const list = await fetchData('/api/companies');

        console.log('[API] fetchCompanies response:', list);

        return list.map(c => ({ ...c, id: c._id }));

    } catch (err) {

        console.error('[API] fetchCompanies ERROR:', err);

        throw err;

    }

};

export const createCompany = async company => {

    console.log('[API] createCompany → POST /api/companies', company);

    try {

        const created = await fetchData('/api/companies', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify(company),

        });

        console.log('[API] createCompany response:', created);

        return { ...created, id: created._id };

    } catch (err) {

        console.error('[API] createCompany ERROR:', err);

        throw err;

    }

};

export const updateCompany = async (id, company) => {

    console.log(`[API] updateCompany → PUT /api/companies/${id}`, company);

    try {

        const updated = await fetchData(`/api/companies/${id}`, {

            method: 'PUT',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify(company),

        });

        console.log('[API] updateCompany response:', updated);

        return { ...updated, id: updated._id };

    } catch (err) {

        console.error('[API] updateCompany ERROR:', err);

        throw err;

    }

};

export const deleteCompany = async id => {

    console.log(`[API] deleteCompany → DELETE /api/companies/${id}`);

    try {

        const result = await fetchData(`/api/companies/${id}`, {

            method: 'DELETE',

        });

        console.log('[API] deleteCompany response:', result);

        return result;

    } catch (err) {

        console.error('[API] deleteCompany ERROR:', err);

        throw err;

    }

};

