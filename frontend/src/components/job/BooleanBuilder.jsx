import { useCallback, useState } from 'react';
import { Box, TextField, Chip } from '@mui/material';
import MUIButton from '../MUI/commonUI/MUIButton';
import { fetchBooleanString, BooleanModal } from './fetchBooleanString.jsx';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';



const BooleanBuilder = ({
    skills: extSkills,
    onChange,
    onAlert,
    usedIn,
    onBooleanString,
    // responseQueryArr,
    ...restProps
}) => {
    const [authState, setAuthState] = useAuthContextState();
    const [, setUiState] = useUiContextState();
    const controlled = Array.isArray(extSkills) && typeof onChange === 'function';
    const [intSkills, setIntSkills] = useState(extSkills || []);
    const skills = controlled ? extSkills : intSkills;
    const updateSkills = newArr => (controlled ? onChange(newArr) : setIntSkills(newArr));

    const [skillInput, setSkillInput] = useState('');
    const [booleanStr, setBooleanStr_] = useState('');
    const [showModal, setShowModal] = useState(false);

    const setBooleanStr = useCallback((obj) => {
        setBooleanStr_(obj);
        onBooleanString?.(obj);
    }, [onBooleanString]);

    const addSkill = v => {
        const s = v.trim();
        if (!s || skills.includes(s)) return;
        updateSkills([...skills, s]);
    };
    const removeSkill = v => updateSkills(skills.filter(x => x !== v));

    const genBoolean = useCallback(async (userEmail = null) => {
        if (!skills.length) {
            onAlert?.({ message: 'Add at least one skill before generating the Boolean string.', severity: 'warning', open: true });
            return;
        }
        // if (usedIn !== 'NewJob' && (responseQueryArr || [])?.length <= 0) {
        //     onAlert?.({ message: 'Feedback required...', severity: 'warning', open: true });
        //     return;
        // }
        try {
            setUiState({
                loadingMsg: "Generating, Please wait..."
            });
            const str = await fetchBooleanString(skills, userEmail ?? authState?.booleanSubmitEmail, ((userEmail ?? authState?.booleanSubmitEmail) ? "AI Boolean Search String" : undefined), setUiState);
            setBooleanStr(str);
            setShowModal(true);
            onAlert?.({ message: 'Boolean string generated!', severity: 'success' });
            setUiState({
                loadingMsg: null
            });
        } catch (err) {
            setUiState({ loadingMsg: null });
            onAlert?.({ message: err.message || 'Failed to generate Boolean string.', severity: 'error', open: true });
        }
    }, [authState?.booleanSubmitEmail, onAlert, setBooleanStr, setUiState, skills]);



    return (
        <Box sx={{ py: 1, pb: 4 }}>
            <TextField
                fullWidth
                size='small'
                label="Enter skills"
                name="skillInput"
                value={skillInput}
                helperText={"Press enter to add..."}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();

                        if (skills?.length >= 3 && usedIn === 'NewJob') {
                            onAlert({ message: 'Only 3 skill(s) are required...', severity: "error" });

                        } else {
                            addSkill(skillInput);
                            setSkillInput('');
                        }
                    }
                }}
                sx={{ mb: 2 }}
                {...restProps}
            />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {skills.map(s => (
                    <Chip key={s} label={s} onDelete={() => removeSkill(s)} />
                ))}
            </Box>

            <MUIButton sx={{ border: "none", borderBottom: 1 }} onClick={() => (authState?.booleanSubmitEmail === "Start of page" && skills?.length >= 1 ? setAuthState({ booleanSubmitEmail: null, }) : genBoolean())}>
                Get Boolean String by AI
            </MUIButton>

            <BooleanModal
                open={showModal}
                booleanString={booleanStr}
                onClose={() => setShowModal(false)}
                onChange={setBooleanStr}
            />
        </Box>
    );
};

export default BooleanBuilder;
