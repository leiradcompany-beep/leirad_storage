// Adjust this to your XAMPP server URL if different
const API_BASE = 'http://localhost/File Sharing/backend/api/';

const api = {
    async request(endpoint, method = 'GET', data = null) {
        const url = API_BASE + endpoint;
        const options = {
            method,
            headers: {},
            credentials: 'include'
        };

        const token = localStorage.getItem('token');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (!(data instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
            if (data) options.body = JSON.stringify(data);
        } else {
            options.body = data;
        }

        try {
            const response = await fetch(url, options);
            const text = await response.text();

            let result;
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error('Server returned non-JSON response:', text);
                throw new Error('Server error: Invalid JSON response');
            }

            if (!response.ok) {
                if (response.status === 401) {
                    const isAuthPage = ['login.html', 'register.html', 'forgot.html', 'verify.html', 'index.html'].some(p => window.location.pathname.includes(p));
                    if (!isAuthPage) {
                        localStorage.removeItem('user');
                        localStorage.removeItem('token');
                        window.location.href = 'login.html';
                        return;
                    }
                }
                const error = new Error(result.message || 'Something went wrong');
                error.status = response.status;
                throw error;
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, 'GET');
    },

    post(endpoint, data) {
        return this.request(endpoint, 'POST', data);
    },

    delete(endpoint, data) {
        return this.request(endpoint, 'DELETE', data);
    },

    upload(endpoint, data) {
        if (data instanceof FormData) {
            return this.request(endpoint, 'POST', data);
        }
        const formData = new FormData();
        formData.append('file', data);
        return this.request(endpoint, 'POST', formData);
    }
};
