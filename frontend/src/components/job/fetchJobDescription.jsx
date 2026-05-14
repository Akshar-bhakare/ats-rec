// src/utils/jobServices/fetchJobDescription.js
import { fetchData, performDeploySafeFetch } from '../../AppUtils/dataAPI';

/**
 * Calls your JD-generation endpoint with the current form data,
 * then injects the result into your `description` field.
 *
 * @param {object} formData  — your entire `data` object
 * @param {(updater: Function) => void} setData
 */
export async function fetchJobDescription(formData, setData, setUiState = null) {
    const { title, skills, jobType, locations,
        minSalary, maxSalary, minExp, maxExp,
        workMode, educations, description: oldDesc } = formData;

    if (!title?.trim?.() || skills.length < 3) {
        throw new Error('Please enter a job title and at least 3 skills before generating the JD.');
    }

    const payload = {
        title,
        jobType,
        locations,
        salary: { min: Number(minSalary) || 0, max: Number(maxSalary) || 0, currency: formData.salaryCurrency || 'INR' },
        experience: { min: Number(minExp) || 0, max: Number(maxExp) || 0 },
        workMode,
        hybridDetails: workMode === 'Hybrid' ? '3 days WFO, 2 days WFH' : '',
        educationDetails: educations?.map?.(ed => ({
            level: ed.level,
            qualification: ed.degree,
            streamOrSpecialization: ed.field,
            boardOrInstitute: ed.institute,
            yearOfCompletion: ed.college,
            gradeType: 'Score',
            gradeValue: ed.score
        })) || [],
        certifications: [],
        positions: Number(formData.positions) || 1,
        skills,
        primarySkills: skills,
        secondarySkills: [],
        description: oldDesc,
        recruiterNotes: formData.notes,
        enableAICall: true,
        isWalkIn: Boolean(formData.isWalkIn)
    };

    try {
        const result = await performDeploySafeFetch(
            "Generate JD",
            async () => await fetchData('/api/jobs/generate-JobDescription', {
                method: 'POST',
                body: JSON.stringify(payload)
            }),
            setUiState,
            "Generating JD"
        );

        if (result.success && result.jobDescription) {
            const { overview, responsibilities, requirements, benefits } = result.jobDescription;
            const full = [
                overview,
                responsibilities.length ? 'Responsibilities:\n' + responsibilities.join('\n') : '',
                requirements.length ? 'Requirements:\n' + requirements.join('\n') : '',
                benefits.length ? 'Benefits:\n' + benefits.join('\n') : ''
            ].filter(Boolean).join('\n\n');

            setData(d => ({ ...d, description: full }));
            return full;
        } else {
            throw new Error(result.message || 'JD generation failed on server.');
        }
    } catch (err) {
        throw new Error(err.message || 'JD generation API error.');
    }
}
