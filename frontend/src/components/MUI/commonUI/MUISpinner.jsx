import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export default function MUISpinner({ size = 80, thickness = 4, text = 'Loading' }) {
    const theme = useTheme();
    // const [dots, setDots] = useState('');

    // // Cycle dots every 500ms: '.', '..', '...', then repeat
    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    //     }, 500);
    //     return () => clearInterval(interval);
    // }, []);

    return (
        <Box
            sx={{
                height: '100vh',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 1300,
            }}
        >
            {/* Gradient definition */}
            <svg width={0} height={0}>
                <defs>
                    <linearGradient id="my_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={theme.palette.primary.dark} />
                        <stop offset="100%" stopColor={theme.palette.info.main} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Spinner */}
            <CircularProgress
                size={size}
                thickness={thickness}
                sx={{
                    'svg circle': {
                        stroke: 'url(#my_gradient)',
                    },
                }}
            />

            {/* Loading Text */}
            <Typography
                variant="h6"
                mt={2}
                sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
                {text}
            </Typography>
        </Box>
    );
}
