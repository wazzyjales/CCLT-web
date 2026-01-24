import { Box, Fab } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function DirectionButton({ direction, onClick, isPressed }) {
  // Map direction to the appropriate icon
  const getIcon = () => {
    switch(direction) {
      case 'up':
        return <ArrowUpwardIcon />;
      case 'down':
        return <ArrowDownwardIcon />;
      case 'left':
        return <ArrowBackIcon />;
      case 'right':
        return <ArrowForwardIcon />;
      default:
        return <ArrowUpwardIcon />;
    }
  };

  return (
    <Box sx={{ '& > :not(style)': { m: 1 } }}>
      <Fab 
        size="large" 
        color={isPressed ? "primary" : "secondary"}
        aria-label={direction}
        onClick={onClick}
        sx={{
          transition: 'all 0.2s ease',
          transform: isPressed ? 'scale(0.95)' : 'scale(1)',
          boxShadow: isPressed ? 1 : 3,
        }}
      >
        {getIcon()}
      </Fab>
    </Box>
  );
}