import { createStateContext } from './createStateContext';

const initialState = {
    companyRowsList: null,
    companiesListViewMode: null,
    companyListMeta: null,
    companyListQuery: null,
    companyInitialValuesDict: null,
    companyWsSubmit: false,
};

const { Provider: CompanyProvider, useContextState: useCompanyContextState } = createStateContext(
    'CompanyContext',
    initialState
);

// eslint-disable-next-line react-refresh/only-export-components
export { CompanyProvider, useCompanyContextState };
