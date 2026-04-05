import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import './Login.css';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isLogin) {
      const result = await login(formData.username, formData.password);
      if (result.success) {
        // Redirect based on role
        navigate(result.isAdmin ? '/admin' : '/movies');
      } else {
        setError(result.message);
      }
    } else {
      // Client-side password match validation
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const result = await register(formData.username, formData.email, formData.password);
      if (result.success) {
        const loginResult = await login(formData.username, formData.password);
        if (loginResult.success) {
          navigate(loginResult.isAdmin ? '/admin' : '/movies');
        }
      } else {
        setError(result.message);
      }
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <motion.div
        className="login-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo Section */}
        <motion.div
          className="login-logo"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 4H20V20H4V4Z"
                stroke="url(#logo-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 4V20"
                stroke="url(#logo-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 4V20"
                stroke="url(#logo-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 12H20"
                stroke="url(#logo-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="logo-gradient" x1="4" y1="4" x2="20" y2="20">
                  <stop stopColor="#6366F1" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="logo-text">Cinema<span className="text-gradient">Booking</span></h1>
          <p className="logo-subtitle">Your Premium Cinema Experience</p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="login-card"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {/* Tab Switcher */}
          <div className="login-tabs">
            <button
              className={`tab ${isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
            >
              Sign In
            </button>
            <button
              className={`tab ${!isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="error-icon">!</span>
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <motion.div
                className="input-group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                  required={!isLogin}
                />
              </motion.div>
            )}

            <motion.div
              className="input-group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                className="input"
                required
              />
            </motion.div>

            <motion.div
              className="input-group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </motion.div>

            {!isLogin && (
              <motion.div
                className="input-group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input"
                  required={!isLogin}
                />
              </motion.div>
            )}

            {isLogin && (
              <motion.div
                className="forgot-password"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Link to="/forgot-password">Forgot password?</Link>
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="btn-submit"
              disabled={loading}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <span className="spinner spinner-sm"></span>
              ) : isLogin ? (
                <>
                  Sign In
                  <svg className="btn-arrow" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19M19 12L12 5M19 12L12 19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              ) : (
                'Create Account'
              )}
            </motion.button>
          </form>

          {/* Social Login Divider */}
          <motion.div 
            className="divider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            Or continue with
          </motion.div>

          {/* Google Login Button */}
          <motion.a
            href={`${import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'https://my-java-app-latest-m50a.onrender.com'}/oauth2/authorization/google`}
            className="btn-google"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="google-icon" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            Sign in with Google
          </motion.a>

          {/* Demo Credentials */}
          <motion.div
            className="demo-credentials"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="demo-title">Demo Credentials:</p>
            <div className="demo-info">
              <span>Admin: admin / password</span>
              <span>User: user / password</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="login-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          © 2024 CinemaBooking. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  );
}

export default Login;
