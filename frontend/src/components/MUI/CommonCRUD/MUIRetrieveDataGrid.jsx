import { useEffect } from 'react';
import { DataGrid, useGridApiRef } from '@mui/x-data-grid';
import { Box, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { RefreshOutlined, EditRounded, ArchiveRounded } from '@mui/icons-material';

export default function MUIRetrieveDataGrid({
    title,
    onRefresh,
    rows = [],
    columns = [],
    onEdit,
    onDelete,
    createButton,
    onRowClick,
    listActionsExtended = undefined,
    actionColumnsProps = {},
    selectable = false,
    selectedIds = [],
    onToggleSelect = () => { },
    hideBuiltInActions = false,
    customActionsRenderer = null,
    initialState: gridInitialState = {},
    hideHeader = false,
    ...restProps
}) {
    const apiRef = useGridApiRef();
    const {
        sx: gridSx,
        autosizeOptions,
        autoSizeColumns,
        checkboxSelection,
        ...gridRestProps
    } = restProps;
    const shouldAddActionColumn =
        listActionsExtended || customActionsRenderer || onEdit || onDelete;
    // const isRowClickable = Boolean(onRowClick) || selectable;
    const autoSizeEnabled = autoSizeColumns !== false;

    const givenActionColConfig = { ...columns?.find?.((col) => col?.field === 'actions') || {}, ...actionColumnsProps };

    const actionColumn = {
        field: 'actions',
        headerName: 'Actions',
        sortable: false,
        headerAlign: 'center',
        align: 'center',
        // minWidth: 120,
        flex: 0,
        disableFlexAdjustment: true,
        renderCell: (params) => (
            <Box sx={{ display: 'flex', justifyContent: "center", alignContent: "center", alignItems: "center", height: "100%", width: "100%", }
            }>
                {!hideBuiltInActions && onEdit && (
                    <IconButton
                        size="small"
                        color="primary"
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit(params.row);
                        }}
                        aria-label="edit row"
                    >
                        <EditRounded fontSize="inherit" />
                    </IconButton>
                )}

                {
                    !hideBuiltInActions && onDelete && !params.row?.isArchived && (
                        <IconButton
                            size="small"
                            color="default"
                            onClick={(event) => {
                                event.stopPropagation();
                                onDelete(params.row);
                            }}
                            aria-label="archive row"
                        >
                            <ArchiveRounded fontSize="inherit" />
                        </IconButton>
                    )
                }

                {customActionsRenderer?.(params)}
                {listActionsExtended?.(params)}
            </Box >
        ),
        ...givenActionColConfig,
    };

    const mergedColumns = shouldAddActionColumn ? [...columns, actionColumn] : columns;

    const normalizedColumns = mergedColumns.map((col) => {
        if (!col) return col;
        const base = {
            ...col,
            flex: autoSizeEnabled ? 1 : (col.flex ?? 1),
            flexGrow: autoSizeEnabled ? 1 : (col.flexGrow ?? col.flex ?? 1),
            headerAlign: col.headerAlign ?? 'center',
        };
        if (autoSizeEnabled) {
            return base;
        }
        if (col.disableFlexAdjustment || col.flex != null) {
            return base;
        }

        if (col.width) {
            const { width, ...rest } = base;
            return {
                ...rest,
                minWidth: rest.minWidth ?? width,
                flex: 1,
            };
        }

        return {
            ...base,
            flex: col.flex ?? 1,
        };
    });

    useEffect(() => {
        if (checkboxSelection && rows.length && apiRef.current) {
            const rowIndex = apiRef.current.getAllRowIds()[0];

            setTimeout(() => {
                apiRef.current.scrollToIndexes({ rowIndex, colIndex: 0 });
            }, 100);
        }
    }, [apiRef, checkboxSelection, rows]);

    useEffect(() => {
        if (!autoSizeEnabled || !rows?.length) return;
        const handle = requestAnimationFrame(() => {
            apiRef.current?.autosizeColumns?.({
                includeHeaders: true,
                includeOutliers: true,
                expand: true,
                disableColumnVirtualization: true,
                ...autosizeOptions,
            });
        });
        return () => cancelAnimationFrame(handle);
    }, [apiRef, autoSizeEnabled, rows, normalizedColumns, autosizeOptions]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 1.5, sm: 2 },
            }}
        >
            {!hideHeader && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: createButton ? 'space-between' : 'center',
                        flexWrap: 'wrap',
                        gap: 1,
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 600,
                            fontSize: 'clamp(1rem, 1.1vw + 0.6rem, 1.35rem)',
                        }}
                    >
                        {title}
                        {Boolean(onRefresh) && (
                            <IconButton size="small" onClick={onRefresh} sx={{ ml: 1 }}>
                                <RefreshOutlined />
                            </IconButton>
                        )}
                    </Typography>
                    {createButton}
                </Box>
            )}

            <Box sx={{ flexGrow: 1, width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
                <DataGrid
                    apiRef={apiRef}
                    rows={rows}
                    columns={normalizedColumns}
                    disableRowSelectionOnClick
                    autosizeOnMount={autoSizeEnabled}
                    autosizeOptions={{
                        includeHeaders: true,
                        includeOutliers: true,
                        expand: false,
                        disableColumnVirtualization: true,
                        ...autosizeOptions,
                    }}
                    initialState={{
                        pagination: { paginationModel: { page: 0, pageSize: 10 } },
                        ...gridInitialState,
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    onRowClick={(params) => {
                        if (selectable) onToggleSelect(params.row);
                        else onRowClick && onRowClick(params.row);
                    }}
                    autoPageSize={false}
                    getRowId={(row) => row?.id ?? row?._id}
                    getRowClassName={(params) => (selectedIds.includes(params.id) ? 'row-selected' : '')}
                    checkboxSelection={checkboxSelection}
                    {...gridRestProps}
                    sx={[{
                        minWidth: 0,
                        width: '100%',
                        maxWidth: '100%',
                        bgcolor: 'background.paper',
                        border: "none",
                        borderColor: 'divider',
                        '& .MuiDataGrid-columnHeaders': {
                            background: (theme) =>
                                `linear-gradient(90deg, ${alpha(theme.palette.grey[200], 0.6)} 0%, ${alpha(theme.palette.grey[100], 0.92)} 100%)`,
                            borderBottom: 1,
                            borderBottomColor: (theme) => alpha(theme.palette.grey[400], 0.35),
                            color: 'text.secondary',
                            fontWeight: 600,
                            fontSize: {
                                xs: '0.72rem',
                                sm: '0.78rem',
                                md: '0.84rem',
                            },
                        },
                        '& .MuiDataGrid-row': {
                            my: 0.7,
                            backgroundColor: 'background.paper',
                            '&:nth-of-type(even)': {
                                backgroundColor: 'background.default',
                            },
                            '&:hover': {
                                boxShadow: 'none',
                                backgroundColor: (theme) => alpha(theme.palette.grey[200], 0.5),
                            },
                        },
                        '& .MuiDataGrid-row.row-selected': {
                            backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.75),
                            borderLeft: (theme) => `3px solid ${theme.palette.primary.main}`,
                        },
                        '& .MuiDataGrid-cell': {
                            py: { xs: 1, sm: 1.25 },
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: {
                                xs: '0.8rem',
                                sm: '0.88rem',
                                md: '0.95rem',
                            },
                        },
                        '& .MuiDataGrid-cellContent': {
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                        },
                        '& .MuiCheckbox-root': {
                            color: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.6 : 0.45),
                            '&.Mui-checked': {
                                color: 'primary.main',
                            },
                        },
                        '& .MuiDataGrid-iconButtonContainer .MuiIconButton-root': {
                            '&:hover': {
                                backgroundColor: (theme) => alpha(theme.palette.grey[300], 0.35),
                            },
                        },
                    }, gridSx]}
                />
            </Box>
        </Box>
    );
}
