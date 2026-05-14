import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';


const MUIFileInput = ({
    label = 'Drag & drop files or click to select',
    onChange,
    files,
    acceptedTypes = [],
    maxFiles = 1,
    sx = {},
    renderContent,
    ...restProps
}) => {

    const dropzoneAccept = {};

    if (acceptedTypes.length) {
        acceptedTypes.forEach(ele => {
            if (ele) {

                dropzoneAccept[ele] = {
                    'application/pdf': ['.pdf'],
                    'application/msword': ['.doc'],
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                }[ele];
            }
        })
    }

    const {
        getRootProps,
        getInputProps,
        acceptedFiles,
        isDragActive,
        open,
    } = useDropzone({
        onDrop: (droppedFiles) => onChange?.(droppedFiles),
        multiple: maxFiles > 1,
        maxFiles,
        accept: dropzoneAccept,
    });

    const inputRef = React.useRef(null);
    const displayedFiles = Array.isArray(files) ? files : acceptedFiles;

    React.useEffect(() => {
        if (!inputRef.current) return;

        if (!displayedFiles.length) {
            inputRef.current.value = '';
            return;
        }

        if (typeof DataTransfer === 'undefined') return;

        const dataTransfer = new DataTransfer();
        displayedFiles.forEach((file) => dataTransfer.items.add(file));
        inputRef.current.files = dataTransfer.files;
    }, [displayedFiles]);

    const dropzoneInputProps = getInputProps();
    const finInpProps = {
        ...dropzoneInputProps,
        ...restProps,
        // Keep explicit field name (e.g., "resumes") for FormData submission.
        name: restProps?.name || dropzoneInputProps?.name,
        accept: acceptedTypes?.length ? acceptedTypes?.join(",") : undefined,
    };

    return (
        <Box
            {...getRootProps()}
            sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'divider',
                borderRadius: 2,
                py: 6,
                textAlign: 'center',
                cursor: 'pointer',
                mb: 3,
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'action.hover' },
                ...sx,
            }}
        >
            <input ref={inputRef} {...finInpProps} />

            {renderContent ? (
                renderContent({ acceptedFiles: displayedFiles, isDragActive, open })
            ) : (
                <>
                    <UploadFileIcon sx={{ fontSize: 40, mb: 1 }} />

                    <Typography>
                        {displayedFiles.length === 0
                            ? label
                            : `${displayedFiles.length} file${displayedFiles.length > 1 ? 's' : ''} selected`}
                    </Typography>

                    {displayedFiles.length > 0 && (
                        <Typography variant="caption" display="block">
                            {displayedFiles.map(f => f.name).join(', ')}
                        </Typography>
                    )}

                    {displayedFiles.length === 0 && <Typography variant="caption" color='warning' display="block">
                        * Max file size 5 MB per file
                    </Typography>}
                </>
            )}
        </Box>
    );
};

export default MUIFileInput;
