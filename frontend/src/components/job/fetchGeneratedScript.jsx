// src/utils/jobServices/fetchGeneratedScript.js
import { fetchData, performDeploySafeFetch } from '../../AppUtils/dataAPI';

function normalizeWorkMode(raw) {
    const base = raw?.split?.('(')[0].trim();
    const valid = ['On-site (Work From Office)', 'Hybrid', 'Remote (Work From Home)', 'Field-based', 'Not specified'];
    return valid.includes(base) ? base : 'On-site';
}

export async function fetchGeneratedScript(
    formData, setData, setUiState = null
) {
    let minimal;

    try {

        let minSal = Number(formData.minSalary) || 0;
        let maxSal = Number(formData.maxSalary) || 0;
        if (minSal > maxSal) [minSal, maxSal] = [maxSal, minSal];

        minimal = {
            title: formData.title,
            company: formData.company,
            positions: Number(formData.positions) || 1,
            experience: {
                min: Number(formData.minExp) || 0,
                max: Number(formData.maxExp) || 0
            },
            jobType: formData.jobType,
            workMode: normalizeWorkMode(formData.workMode),
            hybridDetails: formData.hybridDetails || '',
            locations: formData.locations,
            salary: { min: minSal, max: maxSal, currency: formData.salaryCurrency || 'INR' },
            educationDetails: formData.educations?.map?.(ed => ({
                level: ed.level,
                qualification: ed.degree,
                streamOrSpecialization: ed.field,
                boardOrInstitute: ed.institute,
                yearOfCompletion: ed.college,
                gradeType: 'Score',
                gradeValue: ed.score
            })) || [],
            primarySkills: formData.skills,
            secondarySkills: [],
            description: formData.description,
            recruiterNotes: formData.notes,
            enableAICall: true,
            isWalkIn: Boolean(formData.isWalkIn),
            walkInDetails: formData.isWalkIn
                ? {
                    dateRange: {
                        from: formData.walkInDateFrom || null,
                        to: formData.walkInDateTo || null,
                    },
                    timeRange: {
                        start: formData.walkInTimeStart || null,
                        end: formData.walkInTimeEnd || null,
                    },
                }
                : {},
            status: 'active',
            unit: null
        };

        const res = await performDeploySafeFetch(
            "Generate Script",
            async () => await fetchData('/api/scripts/generate-script', {
                method: 'POST',
                body: JSON.stringify({
                    job: minimal,
                    extraQuestion: formData.scriptExtra || ''
                })
            }),
            setUiState,
            "Generating Script"
        );

        if (res.success && res.content) {
            setData(d => ({ ...d, scriptContent: res.content }));
            return res.content;
        }

        console.warn('Script generation failed:', res?.message);
        return '';

    } catch (err) {
        throw new Error(err.message || 'Script generation API error.');
    }
}
