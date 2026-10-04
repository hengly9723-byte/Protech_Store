import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import 'bootstrap-icons/font/bootstrap-icons.css'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "968981357423-os92276mmfmdfv1diteradinnvogd2q5.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)

