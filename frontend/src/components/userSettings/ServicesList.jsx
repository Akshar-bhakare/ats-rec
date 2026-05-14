/* eslint-disable no-irregular-whitespace, react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, Box, Grid, Typography, Tabs, Tab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import ServiceCard from './ServiceCard';
import MUIButton from '../MUI/commonUI/MUIButton';
import { useUiContextState } from '../../contexts/UiContext';


function mergeByType(clientRows = [], globalRows = []) {
  const byTypeCli = clientRows.reduce((m, r) => { (m[r.serviceType[0]] ||= []).push(r); return m; }, {});
  const byTypeGlob = globalRows.reduce((m, r) => { (m[r.serviceType[0]] ||= []).push(r); return m; }, {});
  const out = [];
  Object.keys({ ...byTypeCli, ...byTypeGlob }).forEach(t => {
    if (byTypeCli[t]) out.push(...byTypeCli[t]);
    else out.push(...byTypeGlob[t].map(r => ({ ...r, __inherited: true })));
  });
  return out;
}

export default function ServicesList({ mode = 'global', clientId = null }) {

  const [, setUiState] = useUiContextState();
  const navigate = useNavigate();
  const location = useLocation();
  const patched = useRef(false);

  const [rows, setRows] = useState([]);
  const [delOpen, setDel] = useState(false);
  const [current, setCur] = useState(null);


  const load = async () => {
    try {
      setUiState({ loadingMsg: "Loading settings..." });

      if (mode === 'global') {
        const data = await fetchData('/api/settings');
        setRows(Array.isArray(data) ? data : data?.docs || []);
      } else {
        const [cli, glob] = await Promise.all([
          fetchData(`/api/settings/client/${clientId}`),
          fetchData('/api/settings'),
        ]);
        setRows(mergeByType(cli || [], glob || []));
      }
    } catch (e) {
      console.error('[ServicesList] fetch failed:', e);
    } finally {
      setUiState({ loadingMsg: null });
    }
  };

  useEffect(() => {
    load();
  }, [mode, clientId]);


  useEffect(() => {
    if (!location.state || patched.current) return;
    let next = [...rows];
    Object.values(location.state).forEach(cfg => {
      if (!cfg || typeof cfg !== 'object') return;
      const idx = next.findIndex(r => String(r._id) === String(cfg._id));
      idx === -1 ? next.push(cfg) : next.splice(idx, 1, cfg);
    });
    setRows(next);
    navigate(location.pathname, { replace: true, state: {} });
    patched.current = true;
  }, [location.state, rows]);


  const svcTypes = useMemo(
    () => ['AI', 'Telephony', 'Video', 'Document', 'Email', 'Messaging', 'Maps', 'Other'], []
  );
  const [tab, setTab] = useState(0);
  const filtered = rows.filter(r => Array.isArray(r.serviceType) &&
    r.serviceType.includes(svcTypes[tab]));


  const destroy = async () => {
    try {
      if (current.__inherited) return setDel(false);

      setUiState({ loadingMsg: 'Deleting setting...' });

      const base = mode === 'client'
        ? `/api/settings/client/${clientId}`
        : '/api/settings';

      await fetchData(`${base}/${current._id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDel(false);
      setUiState({ loadingMsg: null });
    }
  };

  const navToForm = (stateExtra) =>
    navigate('/settings/new/', {
      state: {
        ...(stateExtra || {}),
        ...(mode === 'client' ? { clientId } : {}),
      }
    });



  return (
    <Card sx={{ m: { xs: 0, sm: 2, md: 3 }, p: { xs: 1.5, sm: 2 } }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>Service Configurations</Typography>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          {svcTypes.map(t => <Tab key={t} label={`${t} Services`} />)}
        </Tabs>

        <Box>
          {filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', mt: 6 }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                No {svcTypes[tab].toLowerCase()} services configured
              </Typography>
              <MUIButton startIcon={<AddIcon />}
                onClick={() => navToForm({ defaultServiceType: svcTypes[tab] })}>
                Add {svcTypes[tab]} Service
              </MUIButton>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <MUIButton variant="contained" startIcon={<AddIcon />}
                  onClick={() => navToForm({ defaultServiceType: svcTypes[tab] })}>
                  Add {svcTypes[tab]} Service
                </MUIButton>
              </Box>

              <Grid container spacing={2}>
                {filtered.map(cfg => (
                  <Grid key={cfg._id}
                    sx={{
                      flexBasis: { xs: '100%', sm: '50%', md: '33.33%' },
                      maxWidth: { xs: '100%', sm: '50%', md: '33.33%' }
                    }}>
                    <ServiceCard
                      cfg={cfg}
                      onEdit={() => {
                        if (cfg.__inherited) {
                          const { __inherited, _id, ...prefill } = cfg;
                          navToForm({ prefillService: prefill, defaultServiceType: cfg.serviceType[0] });
                        } else {
                          navToForm({ editService: cfg });
                        }
                      }}
                      onDelete={() => { setCur(cfg); setDel(true); }}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </Box>
      </CardContent>

      <MUIArchiveCnfModal open={delOpen} onClose={() => setDel(false)}
        onConfirm={destroy} itemName={current?.configurationName}>
        Archive
      </MUIArchiveCnfModal>
    </Card>
  );
}
