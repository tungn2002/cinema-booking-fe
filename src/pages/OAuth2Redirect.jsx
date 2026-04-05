import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

function OAuth2Redirect() {
  const { token: tokenParam } = useParams();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      // Check path param, query param, or search params
      let token = tokenParam || searchParams.get('token');

      if (token) {
        const result = loginWithToken(token);
        if (result.success) {
          toast.success('Login successful!');
          // Redirect based on role
          navigate(result.isAdmin ? '/admin' : '/movies', { replace: true });
        } else {
          toast.error('Authentication failed: ' + (result.message || 'Invalid token'));
          navigate('/login', { replace: true });
        }
      } else {
        toast.error('No token found in redirection');
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [tokenParam, searchParams, loginWithToken, navigate]);

  return (
    <div className="loading-screen">
      <div className="spinner spinner-lg"></div>
      <p>Completing login...</p>
    </div>
  );
}

export default OAuth2Redirect;
