import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://my-java-app-latest-m50a.onrender.com/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login if the endpoint actually requires authentication
      // Don't redirect for public endpoints that just happen to return 401
      const excludedPaths = [
        '/movies/',
        '/theaters/',
        '/showtimes/',
        '/seats/',
        '/reviews/movies/',
      ];
      const url = error.config?.url || '';
      const shouldRedirect = !excludedPaths.some(path => url.includes(path));

      if (shouldRedirect) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  getStatus: () => api.get('/auth/status'),
};

// Movie APIs
export const movieAPI = {
  getAll: (params = {}) => api.get('/movies', { params }),
  getById: (id) => api.get(`/movies/${id}`),
  create: (data) => api.post('/movies', data),
  update: (id, data) => api.put(`/movies/${id}`, data),
  delete: (id) => api.delete(`/movies/${id}`),
  uploadPoster: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/movies/${id}/poster`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Showtime APIs
export const showtimeAPI = {
  getByDate: (date) => api.get('/showtimes', { params: { date } }),
  getByMovie: (movieId) => api.get(`/showtimes/movies/${movieId}`),
  getByTheater: (theaterId) => api.get(`/showtimes/theaters/${theaterId}`),
  getAvailable: (params) => api.get('/showtimes/available', { params }),
  getById: (id) => api.get(`/showtimes/${id}`),
  create: (data) => api.post('/showtimes', data),
  update: (id, data) => api.put(`/showtimes/${id}`, data),
  delete: (id) => api.delete(`/showtimes/${id}`),
};

// Reservation APIs
export const reservationAPI = {
  getMyReservations: (params) => api.get('/reservations/my-reservations', { params }),
  getUpcoming: () => api.get('/reservations/my-upcoming-reservations'),
  getById: (id) => api.get(`/reservations/${id}`),
  getAll: (params) => api.get('/reservations/all', { params }),
  create: (data) => api.post('/reservations', data),
  cancel: (id) => api.delete(`/reservations/${id}`),
  getRevenue: (startDate, endDate) =>
    api.get('/reservations/reports/revenue', { params: { startDate, endDate } }),
};

// Payment APIs
export const paymentAPI = {
  createCheckoutSession: (data) => api.post('/payments/create-checkout-session', data),
  getByReservation: (reservationId) => api.get(`/payments/reservation/${reservationId}`),
};

// User APIs
export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  updateRole: (id, roleId) => api.put(`/users/${id}/role`, { roleId }),
  updateStatus: (id, active) => api.put(`/users/${id}/status`, { active }),
  delete: (id) => api.delete(`/users/${id}`),
};

// Theater APIs
export const theaterAPI = {
  getAll: () => api.get('/theaters'),
  getById: (id) => api.get(`/theaters/${id}`),
  search: (location) => api.get('/theaters/search', { params: { location } }),
  create: (data) => api.post('/theaters', data),
  update: (id, data) => api.put(`/theaters/${id}`, data),
  delete: (id) => api.delete(`/theaters/${id}`),
};

// Seat APIs
export const seatAPI = {
  getByShowtime: (showtimeId) => api.get(`/seats/showtimes/${showtimeId}`),
  getAvailable: (showtimeId) => api.get(`/seats/showtimes/${showtimeId}/available`),
};

// Review APIs
export const reviewAPI = {
  addReview: (movieId, data) => api.post(`/reviews/movies/${movieId}`, data),
  getByMovie: (movieId) => api.get(`/reviews/movies/${movieId}`),
  getMyReviews: () => api.get('/reviews/my-reviews'),
  getPending: (params) => api.get('/reviews/pending', { params }),
  approve: (reviewId) => api.put(`/reviews/${reviewId}/approve`),
  reject: (reviewId) => api.put(`/reviews/${reviewId}/reject`),
  upvote: (reviewId) => api.put(`/reviews/${reviewId}/upvote`),
  downvote: (reviewId) => api.put(`/reviews/${reviewId}/downvote`),
  getUnseenCount: () => api.get('/reviews/unseen-count'),
  markAllAsSeen: () => api.put('/reviews/mark-all-as-seen'),
};

// Cloudinary APIs
export const cloudinaryAPI = {
  getAll: () => api.get('/media/cloudinary'),
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media/cloudinary', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (publicId) => api.delete('/media/cloudinary', { params: { publicId } }),
};

// Admin Dashboard APIs
export const dashboardAPI = {
  getMetrics: (startDate, endDate) =>
    api.get('/admin/dashboard/metrics', { params: { startDate, endDate } }),
};

// Master Data APIs
export const masterDataAPI = {
  getComponentTypes: () => api.get('/master-data/component-types'),
  getMasterDataByType: (componentTypeId) =>
    api.get(`/master-data/component-types/${componentTypeId}/master-data`),
};

export default api;
