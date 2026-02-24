import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import PetsIcon from '@mui/icons-material/Pets';
import './Alert.css';

export default function ActionAlerts({ show }) {
  return (
    <div className={`alert-overlay ${show ? 'show' : ''}`}>
      <Stack className="alert-stack" spacing={2}>
        <Alert
          severity="success"
          className="alert-message"
        >
          A Cat has been detected!
        
        </Alert>
      </Stack>
    </div>
  );
}