// script.js

// Utility Functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function createModal() {
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'modal-title');
    modal.setAttribute('aria-describedby', 'modal-description');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <form id="story-form">
                <textarea placeholder="Share your story..." required aria-label="Your story"></textarea>
                <div class="button-group">
                    <button type="submit">Submit</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Add security utilities
const SecurityUtils = {
    csrfToken: document.querySelector('meta[name="csrf-token"]')?.content,
    
    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },
    
    validateInput(input, rules) {
        const errors = [];
        if (rules.required && !input.trim()) {
            errors.push('This field is required');
        }
        if (rules.minLength && input.length < rules.minLength) {
            errors.push(`Minimum length is ${rules.minLength} characters`);
        }
        if (rules.maxLength && input.length > rules.maxLength) {
            errors.push(`Maximum length is ${rules.maxLength} characters`);
        }
        if (rules.pattern && !rules.pattern.test(input)) {
            errors.push('Invalid format');
        }
        return errors;
    },
    
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-CSRF-Token': this.csrfToken,
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        };
    }
};

// Add rate limiting
const RateLimiter = {
    limits: new Map(),
    
    async checkLimit(key, maxRequests = 10, timeWindow = 60000) {
        const now = Date.now();
        const requests = this.limits.get(key) || [];
        
        // Remove old requests
        const validRequests = requests.filter(time => now - time < timeWindow);
        
        if (validRequests.length >= maxRequests) {
            throw new Error('Rate limit exceeded');
        }
        
        validRequests.push(now);
        this.limits.set(key, validRequests);
        return true;
    }
};

// Story Management
function addStory() {
    const modal = createModal();
    const form = modal.querySelector('form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textarea = form.querySelector('textarea');
        const story = textarea.value.trim();
        
        // Validate input
        const errors = SecurityUtils.validateInput(story, {
            required: true,
            minLength: 10,
            maxLength: 1000
        });
        
        if (errors.length > 0) {
            showErrors(errors);
            return;
        }
        
        try {
            const sanitizedStory = SecurityUtils.sanitizeInput(story);
            const storyDiv = document.createElement("div");
            storyDiv.className = 'story';
            storyDiv.innerHTML = `
                <div class="story-content">${sanitizedStory}</div>
                <div class="story-meta">
                    <span class="timestamp">${new Date().toLocaleString()}</span>
                </div>
            `;
            document.getElementById("user-stories").appendChild(storyDiv);
            saveStories();
            closeModal();
        } catch (error) {
            console.error('Error adding story:', error);
            showError('Failed to add story. Please try again.');
        }
    });
}

function validateStory(story) {
    if (story.length < 10) {
        alert('Story must be at least 10 characters long');
        return false;
    }
    return true;
}

// Forum Management
class Forum {
    constructor() {
        this.posts = [];
        this.apiUrl = 'https://api.jsonbin.io/v3/b/YOUR_BIN_ID'; // Replace with your actual API endpoint
        this.init();
    }

    async init() {
        await this.loadPosts();
        this.setupEventListeners();
    }

    async loadPosts() {
        try {
            const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5'); // Replace with your actual API endpoint
            const posts = await response.json();
            this.posts = posts.map(post => ({
                ...post,
                author: 'Anonymous User',
                timestamp: new Date().toISOString()
            }));
            this.renderPosts();
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showError('Failed to load posts. Please try again later.');
        }
    }

    setupEventListeners() {
        const form = document.getElementById('forum-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        const refreshBtn = document.getElementById('refresh-posts');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadPosts());
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('forum-input');
        const content = input.value.trim();

        if (!content) return;

        try {
            const newPost = {
                id: Date.now(),
                title: 'New Post',
                body: content,
                author: 'Current User',
                timestamp: new Date().toISOString()
            };

            // Optimistic UI update
            this.posts.unshift(newPost);
            this.renderPosts();
            input.value = '';

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error('Error creating post:', error);
            this.showError('Failed to create post. Please try again.');
            // Remove the optimistic update
            this.posts = this.posts.filter(post => post.id !== newPost.id);
            this.renderPosts();
        }
    }

    renderPosts() {
        const container = document.getElementById('forum-posts');
        if (!container) return;

        container.innerHTML = this.posts.map(post => `
            <article class="forum-post" role="article">
                <div class="post-content">
                    <div class="post-header">
                        <span class="post-author">${this.escapeHtml(post.author)}</span>
                        <span class="post-time">${this.formatDate(post.timestamp)}</span>
                    </div>
                    <p>${this.escapeHtml(post.body)}</p>
                </div>
                <div class="post-actions">
                    <button onclick="forum.likePost(${post.id})" class="like-btn">
                        <span class="like-icon">❤️</span>
                        <span class="like-count">${post.likes || 0}</span>
                    </button>
                    <button onclick="forum.deletePost(${post.id})" class="delete-btn">
                        <span class="delete-icon">🗑️</span>
                    </button>
                </div>
            </article>
        `).join('');
    }

    async likePost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            post.likes = (post.likes || 0) + 1;
            this.renderPosts();
        }
    }

    async deletePost(postId) {
        if (confirm('Are you sure you want to delete this post?')) {
            this.posts = this.posts.filter(post => post.id !== postId);
            this.renderPosts();
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
            Math.round((date - new Date()) / (1000 * 60 * 60 * 24)),
            'day'
        );
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.getElementById('forum-posts').prepend(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Initialize forum when DOM is loaded
const forum = new Forum();

// Local Storage
function saveStories() {
    const stories = Array.from(document.getElementById('user-stories').children)
        .map(story => story.querySelector('.story-content').textContent);
    localStorage.setItem('userStories', JSON.stringify(stories));
}

function loadStories() {
    const stories = JSON.parse(localStorage.getItem('userStories') || '[]');
    stories.forEach(story => {
        const storyDiv = document.createElement('div');
        storyDiv.className = 'story';
        storyDiv.innerHTML = `
            <div class="story-content">${escapeHtml(story)}</div>
            <div class="story-meta">
                <span class="timestamp">${new Date().toLocaleString()}</span>
            </div>
        `;
        document.getElementById('user-stories').appendChild(storyDiv);
    });
}

// Map Initialization
class MapService {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.markers = new Map();
        this.userMarker = null;
        this.markerCluster = null;
        this.reviews = new Map();
    }

    async init() {
        try {
            // Create map instance
            this.map = L.map(this.containerId).setView([20.5937, 78.9629], 5); // Default center of India

            // Add tile layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);

            // Initialize marker clustering
            this.initializeMarkerClustering();

            // Add search box
            this.addSearchBox();

            // Add user location
            await this.addUserLocation();

            // Load service locations
            await this.loadServiceLocations();

            // Add zoom controls
            this.map.zoomControl.setPosition('topright');

            // Add scale control
            L.control.scale().addTo(this.map);

        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to initialize map. Please try again.');
        }
    }

    async loadServiceLocations() {
        const services = [
            {
                id: 1,
                name: 'Mumbai Immigration Office',
                location: [19.0760, 72.8777],
                type: 'immigration',
                description: 'Main immigration office providing documentation services and support.',
                contact: '+91 22-2222-1111',
                reviews: [
                    {
                        rating: 4,
                        text: "Very helpful staff and clean facilities. The process was smooth.",
                        author: "John D.",
                        date: "2024-02-15",
                        source: "Google Maps"
                    },
                    {
                        rating: 5,
                        text: "Excellent service. The officers were professional and efficient.",
                        author: "Sarah M.",
                        date: "2024-02-10",
                        source: "Quora"
                    }
                ]
            },
            {
                id: 2,
                name: 'Delhi Migrant Community Center',
                location: [28.6139, 77.2090],
                type: 'community',
                description: 'Community center offering housing assistance, job placement, and legal aid.',
                contact: '+91 11-3333-4444',
                reviews: [
                    {
                        rating: 5,
                        text: "Great support for newcomers. They helped me find housing and work.",
                        author: "Maria G.",
                        date: "2024-02-12",
                        source: "Google Maps"
                    },
                    {
                        rating: 4,
                        text: "Wonderful community events and networking opportunities.",
                        author: "Alex P.",
                        date: "2024-02-08",
                        source: "Quora"
                    }
                ]
            },
            {
                id: 3,
                name: 'Bangalore Job Center',
                location: [12.9716, 77.5946],
                type: 'employment',
                description: 'Specialized center for tech and IT sector job opportunities.',
                contact: '+91 80-5555-6666',
                reviews: [
                    {
                        rating: 4,
                        text: "Found a great tech job through their placement program.",
                        author: "David K.",
                        date: "2024-02-14",
                        source: "Google Maps"
                    },
                    {
                        rating: 5,
                        text: "Excellent career counseling and workshop sessions.",
                        author: "Lisa R.",
                        date: "2024-02-11",
                        source: "Quora"
                    }
                ]
            }
        ];

        for (const service of services) {
            await this.addServiceMarker(service);
            this.reviews.set(service.id, service.reviews);
        }
    }

    async addServiceMarker(service) {
        try {
            const icon = this.getCustomIcon(service.type);
            const marker = L.marker(service.location, { icon })
                .bindPopup(this.createServicePopup(service))
                .addTo(this.map);

            this.markers.set(service.id, marker);
            if (this.markerCluster) {
                this.markerCluster.addLayer(marker);
            }
        } catch (error) {
            console.error('Error adding service marker:', error);
        }
    }

    createServicePopup(service) {
        const avgRating = this.calculateAverageRating(service.reviews);
        const stars = this.createRatingStars(avgRating);
        
        const recentReviews = service.reviews
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 2)
            .map(review => `
                <div class="review">
                    <div class="review-header">
                        <span class="review-source">${review.source}</span>
                        <span class="review-date">${this.formatDate(review.date)}</span>
                    </div>
                    <div class="review-rating">${this.createRatingStars(review.rating)}</div>
                    <p class="review-text">${review.text}</p>
                    <span class="review-author">- ${review.author}</span>
                </div>
            `).join('');

        return `
            <div class="service-popup">
                <h3>${service.name}</h3>
                <p>${service.description}</p>
                <div class="rating">
                    ${stars}
                    <span>(${avgRating.toFixed(1)})</span>
                </div>
                <div class="reviews">
                    <h4>Recent Reviews</h4>
                    ${recentReviews}
                </div>
                <p><strong>Contact:</strong> ${service.contact}</p>
                <button class="service-details-btn" onclick="window.open('https://maps.google.com/?q=${service.location[0]},${service.location[1]}')">
                    Get Directions
                </button>
            </div>
        `;
    }

    calculateAverageRating(reviews) {
        if (!reviews || reviews.length === 0) return 0;
        return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    }

    createRatingStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return `
            ${'★'.repeat(fullStars)}
            ${hasHalfStar ? '½' : ''}
            ${'☆'.repeat(emptyStars)}
        `;
    }

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    getCustomIcon(type) {
        const iconUrl = {
            immigration: 'path/to/immigration-icon.png',
            community: 'path/to/community-icon.png',
            employment: 'path/to/employment-icon.png'
        }[type] || 'path/to/default-icon.png';

        return L.icon({
            iconUrl,
            iconSize: [25, 25],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    }

    async addUserLocation() {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            const { latitude, longitude } = position.coords;
            
            if (this.userMarker) {
                this.map.removeLayer(this.userMarker);
            }

            this.userMarker = L.marker([latitude, longitude], {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '📍',
                    iconSize: [25, 25],
                    iconAnchor: [12, 12]
                })
            }).addTo(this.map);

            this.map.setView([latitude, longitude], 12);
        } catch (error) {
            console.error('Error getting user location:', error);
            // Don't show error - user might have denied location access
        }
    }

    addSearchBox() {
        const searchControl = L.control({ position: 'topleft' });

        searchControl.onAdd = () => {
            const container = L.DomUtil.create('div', 'leaflet-control-search');
            const input = L.DomUtil.create('input', 'search-input', container);
            
            input.type = 'text';
            input.placeholder = 'Search for services...';
            
            L.DomEvent.disableClickPropagation(container);
            
            input.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
            
            return container;
        };

        searchControl.addTo(this.map);
    }

    handleSearch(query) {
        query = query.toLowerCase();
        
        this.markers.forEach((marker, id) => {
            const service = this.getServiceById(id);
            if (service.name.toLowerCase().includes(query) || 
                service.description.toLowerCase().includes(query)) {
                marker.setOpacity(1);
            } else {
                marker.setOpacity(0.3);
            }
        });
    }

    getServiceById(id) {
        // This should be implemented to return service data by ID
        // For now, returning a dummy service
        return {
            name: 'Service',
            description: 'Description'
        };
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    initializeMarkerClustering() {
        if (!this.markerCluster) {
            this.markerCluster = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true
            });
            
            this.map.addLayer(this.markerCluster);
        }
    }
}

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const mapService = new MapService('map-container');
    mapService.init();
});

// Add after existing utility functions
const supportedLanguages = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    ar: 'العربية'
};

function changeLanguage(lang) {
    document.documentElement.lang = lang;
    // Fetch and apply translations
    fetch(`/translations/${lang}.json`)
        .then(response => response.json())
        .then(translations => {
            document.querySelectorAll('[data-translate]').forEach(element => {
                const key = element.getAttribute('data-translate');
                if (translations[key]) {
                    element.textContent = translations[key];
                }
            });
        });
}

// Add after existing code
class UserAuth {
    constructor() {
        this.currentUser = null;
    }

    async login(email, password) {
        try {
            // Implement actual authentication logic here
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                this.updateUI();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    }

    updateUI() {
        const authSection = document.querySelector('.auth-section');
        if (this.currentUser) {
            authSection.innerHTML = `
                <span>Welcome, ${escapeHtml(this.currentUser.name)}</span>
                <button onclick="auth.logout()">Logout</button>
            `;
        }
    }
}

const auth = new UserAuth();

// Add new calendar functionality
class EventCalendar {
    constructor() {
        this.events = [];
    }

    addEvent(event) {
        this.events.push(event);
        this.renderEvents();
    }

    renderEvents() {
        const calendarEl = document.getElementById('calendar');
        const events = this.events.map(event => `
            <article class="event-card">
                <h4>${escapeHtml(event.title)}</h4>
                <time datetime="${event.date}">${new Date(event.date).toLocaleDateString()}</time>
                <p>${escapeHtml(event.description)}</p>
                <button onclick="calendar.registerForEvent('${event.id}')" 
                        aria-label="Register for ${escapeHtml(event.title)}">
                    Register
                </button>
            </article>
        `).join('');
        calendarEl.innerHTML = events;
    }
}

// Add real-time chat functionality
class ChatSupport {
    constructor() {
        this.messages = [];
        this.socket = null;
    }

    initialize() {
        // Initialize WebSocket connection
        this.socket = new WebSocket('wss://your-websocket-server');
        this.socket.onmessage = this.handleMessage.bind(this);
    }

    sendMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'message',
                content: message,
                timestamp: new Date().toISOString()
            }));
        }
    }

    handleMessage(event) {
        const message = JSON.parse(event.data);
        this.addMessageToUI(message);
    }
}

// Add progress tracking functionality
class MigrantProgress {
    constructor() {
        this.tasks = new Map();
    }

    addTask(category, task) {
        if (!this.tasks.has(category)) {
            this.tasks.set(category, []);
        }
        this.tasks.get(category).push({
            id: Date.now(),
            title: task,
            completed: false,
            dateAdded: new Date()
        });
        this.saveProgress();
        this.renderProgress();
    }

    toggleTask(taskId) {
        this.tasks.forEach((tasks, category) => {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = !task.completed;
            }
        });
        this.saveProgress();
        this.renderProgress();
    }
}

// Scroll animations
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Animate elements on scroll
document.querySelectorAll('.story, .forum-post, .event-card, .resource-card').forEach(el => {
    observer.observe(el);
});

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Loading animation
window.addEventListener('load', () => {
    const loader = document.querySelector('.loading');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
});

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (hero) {
        const scrolled = window.pageYOffset;
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Add location services
class LocationServices {
    constructor() {
        this.dataService = new DataService();
        this.userLocation = null;
    }

    async updateNearbyServices() {
        if (!this.userLocation) return;
        
        const { latitude, longitude } = this.userLocation.coords;
        const services = await this.dataService.searchServices(latitude, longitude);
        this.displayServices(services);
        
        const locations = await this.dataService.getNearbyLocations(latitude, longitude);
        this.updateMap(locations);
    }

    displayServices(services) {
        services.forEach(service => {
            const categoryList = document.getElementById(`${service.type}-services`);
            if (categoryList) {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="service-item">
                        <h4>${escapeHtml(service.name)}</h4>
                        <p>${escapeHtml(service.contact)}</p>
                        <span class="rating">Rating: ${service.rating}/5</span>
                        ${service.verified ? '<span class="verified">✓ Verified</span>' : ''}
                    </div>
                `;
                categoryList.appendChild(li);
            }
        });
    }

    updateMap(locations) {
        locations.forEach(location => {
            L.marker([location.latitude, location.longitude])
                .bindPopup(`
                    <h3>${escapeHtml(location.name)}</h3>
                    <p>Population: ${location.population.toLocaleString()}</p>
                    <button onclick="showLocationDetails(${location.id})">
                        View Details
                    </button>
                `)
                .addTo(map);
        });
    }
}

// Migration data visualization
class MigrationData {
    constructor() {
        this.dataService = new DataService();
        this.cacheManager = new CacheManager();
    }

    async getMigrationData(state) {
        // Check cache first
        const cachedData = this.cacheManager.get(`migration_${state}`);
        if (cachedData) return cachedData;

        // Fetch from API if not in cache
        const data = await this.dataService.fetchMigrationData(state);
        if (data) {
            this.cacheManager.set(`migration_${state}`, data);
        }
        return data;
    }

    async renderMigrationStats(state) {
        const data = await this.getMigrationData(state);
        if (!data) return;

        const statsContainer = document.getElementById('migration-stats');
        const stateStats = `
            <div class="migration-card" data-state="${state}">
                <h3>Migration from ${state}</h3>
                <div class="destination-chart">
                    ${this.createDestinationChart(data.destinations)}
                </div>
                <div class="reasons-list">
                    <h4>Major Reasons for Migration:</h4>
                    <ul>
                        ${data.majorReasons.map(reason => 
                            `<li>${escapeHtml(reason)}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        `;
        statsContainer.innerHTML = stateStats;
    }
}

class ExperienceSharing {
    constructor() {
        this.mediaTypes = ['text', 'image', 'video', 'audio'];
    }

    createExperienceForm() {
        return `
            <form id="experience-form" class="experience-form">
                <div class="form-group">
                    <label for="origin">Place of Origin</label>
                    <input type="text" id="origin" required>
                </div>
                <div class="form-group">
                    <label for="destination">Current Location</label>
                    <input type="text" id="destination" required>
                </div>
                <div class="form-group">
                    <label for="duration">Duration of Stay</label>
                    <input type="text" id="duration" placeholder="e.g., 2 years">
                </div>
                <div class="form-group">
                    <label for="story">Your Migration Story</label>
                    <textarea id="story" rows="5" required></textarea>
                </div>
                <div class="form-group">
                    <label>Add Media (Optional)</label>
                    <input type="file" multiple accept="image/*,video/*,audio/*">
                </div>
                <div class="form-group">
                    <label>Migration Reasons</label>
                    <select multiple id="reasons">
                        <option value="employment">Employment</option>
                        <option value="education">Education</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="family">Family</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <button type="submit">Share Your Experience</button>
            </form>
        `;
    }
}

class ServiceProvider {
    constructor() {
        this.categories = [
            'Housing', 'Employment', 'Education', 
            'Healthcare', 'Legal', 'Language'
        ];
    }

    createRegistrationForm() {
        return `
            <form id="provider-form" class="provider-form">
                <div class="form-group">
                    <label for="service-name">Service Name</label>
                    <input type="text" id="service-name" required>
                </div>
                <div class="form-group">
                    <label for="category">Service Category</label>
                    <select id="category" required>
                        ${this.categories.map(category => 
                            `<option value="${category.toLowerCase()}">${category}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="description">Service Description</label>
                    <textarea id="description" required></textarea>
                </div>
                <div class="form-group">
                    <label for="location">Service Location</label>
                    <input type="text" id="location" required>
                </div>
                <div class="form-group">
                    <label for="contact">Contact Information</label>
                    <input type="text" id="contact" required>
                </div>
                <button type="submit">Register Service</button>
            </form>
        `;
    }
}

class DataService {
    constructor() {
        this.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api';
        this.endpoints = {
            stories: '/stories',
            migrations: '/migration-data',
            services: '/services',
            users: '/users',
            experiences: '/experiences'
        };
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async fetchWithRetry(url, options, attempts = this.retryAttempts) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    ...SecurityUtils.getHeaders()
                },
                timeout: 5000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (attempts > 1) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.fetchWithRetry(url, options, attempts - 1);
            }
            throw error;
        }
    }

    async fetchMigrationData(state) {
        try {
            return await this.fetchWithRetry(`${this.API_BASE_URL}${this.endpoints.migrations}/${state}`);
        } catch (error) {
            console.error('Error fetching migration data:', error);
            return null;
        }
    }

    async saveStory(storyData) {
        try {
            return await this.fetchWithRetry(`${this.API_BASE_URL}${this.endpoints.stories}`, {
                method: 'POST',
                body: JSON.stringify(storyData)
            });
        } catch (error) {
            console.error('Error saving story:', error);
            throw new Error('Failed to save story');
        }
    }

    async fetchNearbyServices(latitude, longitude, radius = 5) {
        try {
            const url = new URL(`${this.API_BASE_URL}${this.endpoints.services}/nearby`);
            url.searchParams.append('lat', latitude);
            url.searchParams.append('lng', longitude);
            url.searchParams.append('radius', radius);

            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Error fetching nearby services:', error);
            return [];
        }
    }

    async saveExperience(experienceData) {
        try {
            const formData = new FormData();
            // Add text data
            Object.keys(experienceData.text).forEach(key => {
                formData.append(key, experienceData.text[key]);
            });
            // Add media files
            experienceData.media.forEach(file => {
                formData.append('media[]', file);
            });

            const response = await fetch(`${this.API_BASE_URL}${this.endpoints.experiences}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Error saving experience:', error);
            return null;
        }
    }

    getAuthToken() {
        return localStorage.getItem('authToken');
    }

    async getNearbyLocations(lat, lng, radius = 5) {
        try {
            const response = await fetch(
                `${this.API_BASE_URL}/locations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
            );
            return await response.json();
        } catch (error) {
            console.error('Error fetching nearby locations:', error);
            return [];
        }
    }

    async getMigrationStats(origin, year) {
        try {
            const response = await fetch(
                `${this.API_BASE_URL}/migration/stats?origin=${origin}&year=${year}`
            );
            return await response.json();
        } catch (error) {
            console.error('Error fetching migration stats:', error);
            return null;
        }
    }

    async searchServices(lat, lng, type) {
        try {
            const response = await fetch(
                `${this.API_BASE_URL}/services/search?lat=${lat}&lng=${lng}&type=${type}`
            );
            return await response.json();
        } catch (error) {
            console.error('Error searching services:', error);
            return [];
        }
    }
}

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.expiryTimes = new Map();
    }

    set(key, data, expiryMinutes = 30) {
        this.cache.set(key, data);
        this.expiryTimes.set(key, Date.now() + (expiryMinutes * 60 * 1000));
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        if (Date.now() > this.expiryTimes.get(key)) {
            this.cache.delete(key);
            this.expiryTimes.delete(key);
            return null;
        }
        return this.cache.get(key);
    }

    clear() {
        this.cache.clear();
        this.expiryTimes.clear();
    }
}

class DataVisualization {
    constructor() {
        this.stateColors = {
            'Bihar': '#FF6B6B',
            'Delhi': '#4ECDC4',
            'Maharashtra': '#45B7D1',
            'Karnataka': '#96CEB4',
            'Tamil Nadu': '#FFEEAD'
        };
    }

    formatMigrationData(data) {
        const formattedData = [];
        for (const [source, destinations] of Object.entries(data.flows)) {
            for (const [destination, count] of Object.entries(destinations)) {
                formattedData.push({
                    from: source,
                    to: destination,
                    flow: count
                });
            }
        }
        return formattedData;
    }

    getStateColor(state) {
        return this.stateColors[state] || '#CCCCCC';
    }

    createMigrationFlowChart(data) {
        const canvas = document.createElement('canvas');
        canvas.id = 'migrationFlow';
        
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'sankey',
            data: {
                datasets: [{
                    data: this.formatMigrationData(data),
                    colorFrom: (c) => this.getStateColor(c.from),
                    colorTo: (c) => this.getStateColor(c.to),
                    colorMode: 'gradient'
                }]
            },
            options: {
                responsive: true,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
        
        return canvas;
    }

    createReasonsPieChart(reasons) {
        const canvas = document.createElement('canvas');
        canvas.id = 'reasonsChart';
        
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(reasons),
                datasets: [{
                    data: Object.values(reasons),
                    backgroundColor: this.generateColorPalette(Object.keys(reasons).length)
                }]
            },
            options: {
                responsive: true,
                animation: {
                    animateRotate: true,
                    animateScale: true
                }
            }
        });
        
        return canvas;
    }

    createTimelineVisualization(timelineData) {
        return `
            <div class="timeline">
                ${timelineData.map((item, index) => `
                    <div class="timeline-item" style="--delay: ${index * 0.2}s">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <h3>${escapeHtml(item.year)}</h3>
                            <p>${escapeHtml(item.description)}</p>
                            <div class="timeline-stats">
                                <span>Population: ${item.population.toLocaleString()}</span>
                                <span>Growth: ${item.growth}%</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

class RealTimeUpdates {
    constructor() {
        this.socket = new WebSocket('wss://api.migrantresourcehub.com/ws');
        this.notifications = new Set();
    }

    initialize() {
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleUpdate(data);
        };

        this.socket.onopen = () => {
            this.subscribeToUpdates();
        };
    }

    handleUpdate(data) {
        switch(data.type) {
            case 'new_service':
                this.addNewService(data.service);
                this.showNotification('New service available in your area!');
                break;
            case 'emergency_alert':
                this.showEmergencyAlert(data.alert);
                break;
            case 'migration_update':
                this.updateMigrationStats(data.stats);
                break;
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <p>${escapeHtml(message)}</p>
                <button onclick="this.parentElement.remove()">✕</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}

// Add performance utilities
const PerformanceUtils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    memoize(func) {
        const cache = new Map();
        return (...args) => {
            const key = JSON.stringify(args);
            if (cache.has(key)) return cache.get(key);
            const result = func.apply(this, args);
            cache.set(key, result);
            return result;
        };
    }
};

// Add accessibility manager
class AccessibilityManager {
    constructor() {
        this.focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        this.init();
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupScreenReaderAnnouncements();
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-user');
            }
            
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-user');
        });
    }

    setupFocusManagement() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const focusableElements = modal.querySelectorAll(this.focusableElements);
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];

            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    if (e.shiftKey && document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            });
        });
    }

    setupScreenReaderAnnouncements() {
        if (!document.getElementById('sr-announcer')) {
            const announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.classList.add('sr-only');
            document.body.appendChild(announcer);
        }
    }

    announce(message, priority = 'polite') {
        const announcer = document.getElementById('sr-announcer');
        announcer.setAttribute('aria-live', priority);
        announcer.textContent = message;
    }

    handleEscapeKey() {
        const modal = document.querySelector('.modal[aria-modal="true"]');
        if (modal) {
            closeModal();
        }
    }
}

// Update story card creation with accessibility
function createStoryCard(story) {
    const article = document.createElement('article');
    article.className = 'story-card';
    article.setAttribute('role', 'article');
    article.setAttribute('aria-labelledby', `story-title-${story.id}`);
    
    article.innerHTML = `
        <div class="story-header">
            <div class="author-info">
                <h3 id="story-title-${story.id}">${SecurityUtils.sanitizeInput(story.author)}</h3>
                <div class="migration-path" role="text">
                    <span class="origin">${SecurityUtils.sanitizeInput(story.origin)}</span>
                    <span class="arrow" aria-hidden="true">→</span>
                    <span class="destination">${SecurityUtils.sanitizeInput(story.destination)}</span>
                </div>
            </div>
            <time datetime="${story.date}" aria-label="Posted on ${new Date(story.date).toLocaleDateString()}">${new Date(story.date).toLocaleDateString()}</time>
        </div>
        <div class="story-content">
            <p>${SecurityUtils.sanitizeInput(story.content)}</p>
        </div>
        <div class="story-footer">
            <button class="like-button" 
                    onclick="likeStory(${story.id})" 
                    aria-label="Like this story"
                    aria-pressed="false">
                <span class="like-count" aria-live="polite">${story.likes}</span>
                <span class="like-text">Likes</span>
            </button>
            <button class="share-button" 
                    onclick="shareStory(${story.id})" 
                    aria-label="Share this story">
                Share
            </button>
        </div>
    `;
    return article;
}

// Update search functionality with performance optimization
function initializeSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;

    const debouncedSearch = PerformanceUtils.debounce((query) => {
        performSearch(query);
    }, 300);

    searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
}

// Initialize accessibility manager
const accessibilityManager = new AccessibilityManager();

// ... existing code ...