/**
 * AWS QuickSight Integration
 * This module handles embedding QuickSight dashboards into the application
 */

const QuickSightDashboard = {
  // Dashboard container element
  dashboardContainer: document.getElementById('quicksight-container'),
  
  // Current dashboard session
  currentSession: null,
  
  // Initialize QuickSight dashboard
  init: function() {
    console.log('Initializing QuickSight dashboard integration');
    this.setupEventListeners();
  },
  
  // Set up event listeners
  setupEventListeners: function() {
    // Listen for dashboard tab activation
    document.querySelector('a[data-page="dashboard"]').addEventListener('click', () => {
      // Small delay to ensure the dashboard page is visible
      setTimeout(() => {
        this.loadDashboard();
      }, 100);
    });
    
    // Listen for window resize to adjust dashboard size
    window.addEventListener('resize', this.resizeDashboard.bind(this));
  },
  
  // Load the QuickSight dashboard
  loadDashboard: async function() {
    try {
      if (!this.dashboardContainer) {
        console.error('Dashboard container not found');
        return;
      }
      
      // Show loading indicator
      this.dashboardContainer.innerHTML = '<div class="quicksight-loading">Loading QuickSight dashboard...</div>';
      
      // Get dashboard embedding URL from your backend
      const dashboardData = await this.getDashboardEmbeddingURL();
      
      if (!dashboardData || !dashboardData.embedUrl) {
        throw new Error('Failed to get dashboard embedding URL');
      }
      
      // Embed the dashboard
      this.embedDashboard(dashboardData.embedUrl);
      
    } catch (error) {
      console.error('Error loading QuickSight dashboard:', error);
      this.dashboardContainer.innerHTML = `
        <div class="quicksight-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load dashboard. Please try again later.</p>
          <button id="retry-dashboard-btn" class="btn">Retry</button>
        </div>
      `;
      
      document.getElementById('retry-dashboard-btn').addEventListener('click', () => {
        this.loadDashboard();
      });
    }
  },
  
  // Get dashboard embedding URL from your backend
  getDashboardEmbeddingURL: async function() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/embed-url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get dashboard embedding URL');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard embedding URL:', error);
      throw error;
    }
  },
  
  // Embed the QuickSight dashboard using the AWS SDK
  embedDashboard: function(embedUrl) {
    // Clear any existing content
    this.dashboardContainer.innerHTML = '';
    
    // Create a container for the dashboard iframe
    const frameContainer = document.createElement('div');
    frameContainer.className = 'quicksight-frame-container';
    this.dashboardContainer.appendChild(frameContainer);
    
    // Create dashboard options
    const dashboardOptions = {
      url: embedUrl,
      container: frameContainer,
      height: 'min(80vh, 800px)',
      width: '100%',
      locale: 'en-US',
      footerPaddingEnabled: true,
      loadingHeight: 400,
      scrolling: 'no',
      parameters: {
        country: 'United States',
        states: [
          'California',
          'Washington'
        ]
      }
    };
    
    // Check if AWS QuickSight Embedding SDK is loaded
    if (window.QuickSightEmbedding) {
      const embeddingOptions = {
        onMessage: (payload) => {
          console.log('QuickSight message:', payload);
          // Handle specific QuickSight messages if needed
        },
        onError: (error) => {
          console.error('QuickSight embedding error:', error);
          this.handleEmbeddingError(error);
        }
      };
      
      // Embed the dashboard
      this.currentSession = window.QuickSightEmbedding.embedDashboard(dashboardOptions, embeddingOptions);
    } else {
      // Fallback to iframe if SDK is not loaded
      console.warn('QuickSight Embedding SDK not found, falling back to iframe embedding');
      const iframe = document.createElement('iframe');
      iframe.setAttribute('src', embedUrl);
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', 'min(80vh, 800px)');
      frameContainer.appendChild(iframe);
    }
    
    // Resize to fit container
    this.resizeDashboard();
  },
  
  // Handle embedding errors
  handleEmbeddingError: function(error) {
    this.dashboardContainer.innerHTML = `
      <div class="quicksight-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading dashboard: ${error.message || 'Unknown error'}</p>
        <button id="retry-dashboard-btn" class="btn">Retry</button>
      </div>
    `;
    
    document.getElementById('retry-dashboard-btn').addEventListener('click', () => {
      this.loadDashboard();
    });
  },
  
  // Resize dashboard to fit container
  resizeDashboard: function() {
    if (this.dashboardContainer && this.dashboardContainer.offsetHeight > 0) {
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight : 0;
      const navHeight = document.querySelector('nav') ? document.querySelector('nav').offsetHeight : 0;
      const containerTop = this.dashboardContainer.getBoundingClientRect().top;
      const availableHeight = window.innerHeight - containerTop - 40; // 40px for padding
      
      // Set minimum height
      const minHeight = Math.max(400, availableHeight);
      this.dashboardContainer.style.height = `${minHeight}px`;
      
      // Update iframe height if exists
      const iframe = this.dashboardContainer.querySelector('iframe');
      if (iframe) {
        iframe.style.height = `${minHeight}px`;
      }
    }
  }
};

// Export the module
window.QuickSightDashboard = QuickSightDashboard;
