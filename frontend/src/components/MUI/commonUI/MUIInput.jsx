import { Autocomplete, TextField } from '@mui/material';

export const MUIInput = ({ AutocompleteProps = {}, AutocompleteInputProps = {}, formData = {}, ...props }) => {
    const autocompletePropsWithDefaults = {
        size: "small",
        freeSolo: true,
        getOptionLabel: opt => typeof opt === 'string' ? opt : String(opt.label ?? opt.value ?? ''),
        options: [],
        ...AutocompleteProps || {},
        value: props?.value !== undefined ? props.value : (AutocompleteProps?.value !== undefined ? AutocompleteProps.value : null),
        defaultValue: props?.defaultValue !== undefined ? props?.defaultValue : (AutocompleteProps?.defaultValue !== undefined ? AutocompleteProps.defaultValue : undefined)
    };

    const autoCompleteInputPropsWithDefaults = {
        label: "Enter a value",
        variant: "outlined",
        type: 'text',
        value: (AutocompleteInputProps?.name && AutocompleteInputProps?.name in formData) ? formData?.[AutocompleteInputProps?.name] : (props?.value || (props.AutocompleteInputProps?.value || AutocompleteProps?.value)),
        ...AutocompleteInputProps || {},
    };

    return (
        [autocompletePropsWithDefaults?.type, autoCompleteInputPropsWithDefaults?.type].includes("text") && autocompletePropsWithDefaults.options?.length <= 0 ?
            <TextField
                sx={{ display: "flex", ...props?.sx || {} }}
                size={autocompletePropsWithDefaults?.size || undefined}
                {...autoCompleteInputPropsWithDefaults}
            />
            :
            <Autocomplete
                {...autocompletePropsWithDefaults}
                sx={{ display: "flex", ...props?.sx || {} }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        {...autoCompleteInputPropsWithDefaults}
                    />
                )}
            />
    );
};

export default MUIInput;
