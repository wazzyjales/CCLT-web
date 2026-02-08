import { Box, Button} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function DirectionButton({ direction, onClick, isPressed }) {
  const getIcon = () => {
    switch(direction) {
      case 'ArrowUp':
        return <ArrowUpwardIcon/>;
      case 'ArrowDown':
        return <ArrowDownwardIcon />;
      case 'ArrowLeft':
        return <ArrowBackIcon />;
      case 'ArrowRight':
        return <ArrowForwardIcon />;
      default:
        return <ArrowUpwardIcon />;
    }
  };

return (
    <Box sx={{ '& > :not(style)': { m: 1 } }}>
      <Button 
        variant="contained"
        aria-label={direction}
        onClick={onClick}
        sx={{
          backgroundColor: '#ec407a', // Pink shades
          '&:hover': {
            backgroundColor: '#ff92a8',
          },
          transition: 'all 0.2s ease',
          transform: isPressed ? 'scale(0.95)' : 'scale(1)',
          boxShadow: isPressed ? 1 : 3,
          width: 90,
          height: 90,
          borderRadius: 2,
          minWidth: 'unset',
        }}
      >
        {getIcon()}
      </Button>
    </Box>
);
}