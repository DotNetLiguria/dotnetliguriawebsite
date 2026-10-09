import React, { FC, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import AddIcon from '@mui/icons-material/Add';
import { createQuestionnaireAdminApi } from '../../questionnaire/api';
import { statusColors, statusLabels } from '../../questionnaire/status';
import type { Questionnaire } from '../../questionnaire/types';

/** Questionnaires linked to a workshop, shown in the admin workshop detail. */
const WorkshopQuestionnaires: FC<{ workshopId: string }> = ({ workshopId }) => {
  const navigate = useNavigate();
  const { fetch } = useOidcFetch();
  const api = useMemo(() => createQuestionnaireAdminApi(fetch), [fetch]);
  const [items, setItems] = useState<Questionnaire[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.byWorkshop(workshopId)
      .then(result => { if (active) setItems(result); })
      .catch(err => { if (active) { setItems([]); setError(err instanceof Error ? err.message : 'Impossibile caricare i questionari.'); } });
    return () => { active = false; };
  }, [api, workshopId]);

  const create = async () => {
    setBusy(true);
    try {
      const created = await api.create({ template: 'workshopFeedback', workshopId });
      navigate(`/admin/questionnaires/${created.questionnaireId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
      setBusy(false);
    }
  };

  return (
    <Box sx={{ width: '100%', mt: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Questionari collegati</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {items && items.length === 0 && !error && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Nessun questionario: il link di feedback mostrerà un messaggio finché non ne pubblichi uno.
        </Typography>
      )}
      <Stack spacing={1} sx={{ mb: 1 }}>
        {items?.map(q => (
          <Stack key={q.questionnaireId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Link component={RouterLink} to={`/admin/questionnaires/${q.questionnaireId}/edit`} sx={{ flex: 1 }}>{q.title}</Link>
            <Chip size="small" label={statusLabels[q.status]} color={statusColors[q.status]} />
            <Link component={RouterLink} to={`/admin/questionnaires/${q.questionnaireId}/results`} variant="body2">
              {q.responseCount} risposte
            </Link>
          </Stack>
        ))}
      </Stack>
      <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={busy} onClick={() => void create()}>
        Crea questionario di feedback
      </Button>
    </Box>
  );
};

export default WorkshopQuestionnaires;
