import { createStateContext } from './createStateContext';

const initialState = {
    campaignInitialValuesDict: null,
    aICampaignListRows: null,
    aICampaignsListViewMode: null,
};

const { Provider: AICampaignProvider, useContextState: useAICampaignContextState } = createStateContext(
    'AICampaignContext',
    initialState
);

export { AICampaignProvider, useAICampaignContextState };
