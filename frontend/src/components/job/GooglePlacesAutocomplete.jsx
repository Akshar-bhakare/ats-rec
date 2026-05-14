/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    CircularProgress,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    TextField,
} from '@mui/material';
import usePlacesAutocomplete from 'use-places-autocomplete';

const maskKey = (k) => (k ? `${String(k).slice(0, 6)}…${String(k).slice(-4)}` : '(missing)');

const loadPlacesScriptOnce = (() => {
    let promise;
    return (apiKey) => {
        if (typeof window === 'undefined') return Promise.resolve(false);
        if (window.google?.maps?.places) {
            return Promise.resolve(true);
        }
        if (promise) {
            return promise;
        }
        if (!apiKey) {
            return Promise.resolve(false);
        }

        window.gm_authFailure = () => { };

        promise = new Promise((resolve) => {
            const existing = document.querySelector('script[data-gmaps="places"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(true), { once: true });
                existing.addEventListener('error', () => resolve(false), { once: true });
                return;
            }

            const s = document.createElement('script');
            s.async = true;
            s.defer = true;
            s.setAttribute('data-gmaps', 'places');
            s.src =
                `https://maps.googleapis.com/maps/api/js` +
                `?key=${encodeURIComponent(apiKey)}` +
                `&libraries=places&language=en&v=weekly`;
            s.onload = () => resolve(true);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });

        return promise;
    };
})();

export default function GooglePlacesAutocomplete({
    label = 'Add Location and press Enter',
    placeholder = '',
    onSelect,
    sx,
}) {
    const apiKey = import.meta.env.VITE_GMAPS_API_KEY;

    const {
        ready,
        value,
        setValue,
        suggestions: { status, data, loading },
        clearSuggestions,
        init,
    } = usePlacesAutocomplete({
        debounce: 250,
        initOnMount: false,
        requestOptions: {
            // componentRestrictions: { country: ['in'] },
        },
    });

    const inittedRef = useRef(false);
    useEffect(() => {
        let alive = true;
        (async () => {
            const ok = await loadPlacesScriptOnce(apiKey);
            if (!alive) return;
            if (ok && window.google?.maps?.places && !inittedRef.current) {
                try {
                    init();
                    inittedRef.current = true;
                } catch (e) {
                    // no-op
                }
            } else {
                // no-op
            }
        })();
        return () => {
            alive = false;
        };
    }, [apiKey, init]);


    const [open, setOpen] = useState(false);
    const blurTimer = useRef(null);

    const handleChange = (e) => {
        const v = e.target.value;
        setValue(v);
        if (!v.trim()) {
            clearSuggestions();
            setOpen(false);
            return;
        }
        setOpen(true);
    };

    const acceptValue = (labelText) => {
        if (!labelText) return;
        onSelect?.(labelText);
        setValue('', false);
        clearSuggestions();
        setOpen(false);
    };

    const handleEnter = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = (value || '').trim();
        if (v) acceptValue(v);
    };

    const handlePick = (opt) => {
        const label = opt?.description || '';
        acceptValue(label);
    };

    const onFocus = () => {
        if (data?.length) setOpen(true);
    };
    const onBlur = () => {
        blurTimer.current = setTimeout(() => {
            setOpen(false);
        }, 120);
    };
    useEffect(() => () => clearTimeout(blurTimer.current), []);

    useEffect(() => {
        const shouldOpen = Boolean(value) && status === 'OK' && (data?.length ?? 0) > 0;
        setOpen(shouldOpen);
    }, [status, data, value, ready]);

    const items = useMemo(() => data ?? [], [data]);

    return (
        <Box sx={{ position: 'relative', ...sx }}>
            <TextField
                label={label}
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
                onKeyDown={handleEnter}
                onFocus={onFocus}
                onBlur={onBlur}
                fullWidth
                size="small"
                helperText={!ready ? 'Loading Google Places… (free type works meanwhile)' : ''}
            />

            {loading && (
                <Box sx={{ position: 'absolute', right: 10, top: 12 }}>
                    <CircularProgress size={18} />
                </Box>
            )}

            {open && (
                <Paper
                    elevation={6}
                    sx={{
                        position: 'absolute',
                        zIndex: 10,
                        mt: 0.5,
                        left: 0,
                        right: 0,
                        maxHeight: 280,
                        overflowY: 'auto',
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => clearTimeout(blurTimer.current)}
                    onMouseLeave={() => setOpen(false)}
                >
                    <List dense>
                        {items.map((opt, idx) => {
                            const primary = opt.structured_formatting?.main_text || opt.description;
                            const secondary = opt.structured_formatting?.secondary_text;
                            return (
                                <ListItemButton
                                    key={opt.place_id ?? idx}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handlePick(opt)}
                                >
                                    <ListItemText primary={primary} secondary={secondary} />
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Paper>
            )}
        </Box>
    );
}
