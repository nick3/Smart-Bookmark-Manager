// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart Bookmark Manager installed');
});

// Configuration for retry mechanisms
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2
};

// Utility functions for error handling
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt) {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

function logError(context, error, additionalInfo = {}) {
  console.error(`[${context}] Error:`, error.message, additionalInfo);
  
  // Store error info for debugging
  const errorInfo = {
    timestamp: Date.now(),
    context,
    error: error.message,
    stack: error.stack,
    ...additionalInfo
  };
  
  // Save to local storage for debugging (keep only last 50 errors)
  chrome.storage.local.get(['errorLogs'], (result) => {
    const logs = result.errorLogs || [];
    logs.push(errorInfo);
    if (logs.length > 50) {
      logs.shift();
    }
    chrome.storage.local.set({ errorLogs: logs });
  });
}

// Generic retry wrapper
async function withRetry(operation, context, maxRetries = RETRY_CONFIG.maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      logError(context, error, { attempt, maxRetries });
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = calculateDelay(attempt);
      console.warn(`[${context}] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAllBookmarks') {
    getAllBookmarks().then(sendResponse);
    return true;
  } else if (request.action === 'checkUrl') {
    checkUrlAccessibility(request.url).then(sendResponse);
    return true;
  } else if (request.action === 'analyzeWebsite') {
    analyzeWebsiteContent(request.url, request.settings).then(sendResponse);
    return true;
  } else if (request.action === 'organizeBookmarks') {
    organizeBookmarks(request.categorizedBookmarks, request.brokenBookmarks, request.settings).then(sendResponse);
    return true;
  } else if (request.action === 'testLLMConnection') {
    testLLMConnection(request.settings).then(sendResponse);
    return true;
  }
});

async function getAllBookmarks() {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const allBookmarks = [];
    
    function extractBookmarks(nodes) {
      for (const node of nodes) {
        if (node.url && node.url.startsWith('http')) {
          allBookmarks.push({
            id: node.id,
            title: node.title || node.url,
            url: node.url,
            parentId: node.parentId,
            dateAdded: node.dateAdded
          });
        }
        if (node.children) {
          extractBookmarks(node.children);
        }
      }
    }
    
    extractBookmarks(bookmarkTree);
    console.log(`Found ${allBookmarks.length} bookmarks`);
    return allBookmarks;
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    return [];
  }
}

async function checkUrlAccessibility(url) {
  if (!url || !url.startsWith('http')) {
    return { 
      accessible: false, 
      error: 'Invalid URL format',
      permanent: true 
    };
  }

  return await withRetry(async () => {
    try {
      // First try HEAD request (faster)
      const headResponse = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      return { 
        accessible: true, 
        status: 'OK',
        method: 'HEAD'
      };
    } catch (headError) {
      // If HEAD fails, try GET request
      try {
        const getResponse = await fetch(url, { 
          method: 'GET',
          mode: 'no-cors',
          signal: AbortSignal.timeout(15000) // 15 second timeout for GET
        });
        
        return { 
          accessible: true, 
          status: 'OK',
          method: 'GET'
        };
      } catch (getError) {
        // Check if it's a network error or timeout
        const isNetworkError = getError.name === 'TypeError' || 
                              getError.name === 'AbortError' ||
                              getError.message.includes('Failed to fetch');
        
        return { 
          accessible: false, 
          error: getError.message,
          permanent: !isNetworkError,
          networkError: isNetworkError
        };
      }
    }
  }, `URL-Check-${url}`, 2); // Only 2 retries for URL checks
}

async function analyzeWebsiteContent(url, settings = {}) {
  try {
    const domain = new URL(url).hostname;
    
    // If LLM analysis is enabled and API key is provided, use AI
    if (settings.enableLLMAnalysis && settings.apiKey) {
      try {
        const llmResult = await analyzWithLLM(url, domain, settings);
        if (llmResult.success) {
          return llmResult.data;
        }
        logError('LLM-Analysis', new Error(llmResult.error), { url, domain });
      } catch (error) {
        logError('LLM-Analysis', error, { url, domain });
      }
    }
    
    // Fallback to domain-based categorization
    return getDomainBasedCategory(domain, url);
  } catch (error) {
    logError('Website-Analysis', error, { url });
    return getFallbackCategory(url);
  }
}

function getDomainBasedCategory(domain, url) {
  const categories = {
    'github.com': 'Development',
    'gitlab.com': 'Development',
    'bitbucket.org': 'Development',
    'stackoverflow.com': 'Development',
    'stackexchange.com': 'Development',
    'dev.to': 'Development',
    'codepen.io': 'Development',
    'jsfiddle.net': 'Development',
    'replit.com': 'Development',
    'youtube.com': 'Entertainment',
    'netflix.com': 'Entertainment',
    'twitch.tv': 'Entertainment',
    'spotify.com': 'Entertainment',
    'soundcloud.com': 'Entertainment',
    'amazon.com': 'Shopping',
    'ebay.com': 'Shopping',
    'etsy.com': 'Shopping',
    'aliexpress.com': 'Shopping',
    'google.com': 'Search/Tools',
    'bing.com': 'Search/Tools',
    'duckduckgo.com': 'Search/Tools',
    'facebook.com': 'Social Media',
    'twitter.com': 'Social Media',
    'instagram.com': 'Social Media',
    'linkedin.com': 'Professional',
    'behance.net': 'Professional',
    'dribbble.com': 'Professional',
    'news.': 'News',
    'cnn.com': 'News',
    'bbc.com': 'News',
    'wikipedia.org': 'Reference',
    'reddit.com': 'Community',
    'discord.com': 'Community',
    'medium.com': 'Reference',
    'notion.so': 'Productivity',
    'trello.com': 'Productivity',
    'slack.com': 'Productivity'
  };
  
  let category = 'Other';
  let confidence = 0.7;
  
  // Direct domain match
  for (const [pattern, cat] of Object.entries(categories)) {
    if (domain.includes(pattern)) {
      category = cat;
      confidence = 0.9;
      break;
    }
  }
  
  // Additional heuristics based on domain patterns
  if (category === 'Other') {
    if (domain.includes('blog') || domain.includes('medium') || domain.includes('substack')) {
      category = 'Reference';
      confidence = 0.8;
    } else if (domain.includes('shop') || domain.includes('store')) {
      category = 'Shopping';
      confidence = 0.8;
    } else if (domain.includes('news') || domain.includes('journal')) {
      category = 'News';
      confidence = 0.8;
    } else if (domain.includes('edu') || domain.includes('university')) {
      category = 'Education';
      confidence = 0.8;
    }
  }
  
  return {
    category,
    confidence,
    description: `Website categorized as ${category.toLowerCase()} based on domain analysis`,
    method: 'domain-based'
  };
}

function getFallbackCategory(url) {
  return {
    category: 'Other',
    confidence: 0.1,
    description: 'Could not analyze website content - using default category',
    method: 'fallback',
    url: url
  };
}

async function analyzWithLLM(url, domain, settings) {
  return await withRetry(async () => {
    const prompt = `Analyze this website and categorize it. 
Website URL: ${url}
Domain: ${domain}

Please categorize this website into one of these categories:
- Development (programming, coding, software tools)
- Entertainment (videos, movies, music, games)
- Shopping (e-commerce, online stores)
- Search/Tools (search engines, utilities)
- Social Media (social networks, messaging)
- Professional (business, career, work tools)
- News (news sites, journalism)
- Reference (documentation, wikis, learning)
- Community (forums, discussion boards)
- Productivity (task management, notes, collaboration)
- Education (learning platforms, courses)
- Other (if none of the above fit)

Respond in JSON format with:
{
  "category": "category_name",
  "confidence": 0.0-1.0,
  "description": "brief description of why this category fits"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.3
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid API response format');
      }

      const content = data.choices[0].message.content;
      
      // Try to parse JSON response with error handling
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        // If JSON parsing fails, try to extract category from text
        const categoryMatch = content.match(/category[":]\s*["']([^"']+)["']/i);
        if (categoryMatch) {
          result = {
            category: categoryMatch[1],
            confidence: 0.7,
            description: 'Parsed from non-JSON response'
          };
        } else {
          throw new Error(`Failed to parse LLM response: ${content}`);
        }
      }

      // Validate result
      if (!result.category) {
        throw new Error('LLM response missing category');
      }

      return {
        success: true,
        data: {
          category: result.category,
          confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
          description: result.description || 'AI-generated category',
          method: 'llm-analysis'
        }
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, `LLM-Analysis-${domain}`, 2); // Only 2 retries for LLM calls
}

async function testLLMConnection(settings) {
  return await withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: [
            {
              role: 'user',
              content: 'Hello! Please respond with "Connection successful" if you can read this.'
            }
          ],
          max_tokens: 50
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid API response format');
      }

      return {
        success: true,
        message: 'Connection successful',
        model: data.model || settings.modelName,
        response: data.choices[0].message.content
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, 'LLM-Connection-Test', 2);
}

async function organizeBookmarks(categorizedBookmarks, brokenBookmarks, settings) {
  let organizationResult = {
    success: true,
    organized: 0,
    removed: 0,
    errors: [],
    partialSuccess: false
  };

  try {
    // Create main organization folder with retry
    const organizationFolder = await withRetry(async () => {
      return await chrome.bookmarks.create({
        parentId: '1', // Bookmarks bar
        title: 'Organized Bookmarks',
        index: 0
      });
    }, 'Create-Organization-Folder', 3);

    // Create category folders and move bookmarks
    for (const [categoryName, bookmarks] of Object.entries(categorizedBookmarks)) {
      if (bookmarks.length === 0) continue;

      try {
        // Create category folder with retry
        const categoryFolder = await withRetry(async () => {
          return await chrome.bookmarks.create({
            parentId: organizationFolder.id,
            title: categoryName
          });
        }, `Create-Category-${categoryName}`, 3);

        // Move bookmarks to category folder
        for (const bookmark of bookmarks) {
          try {
            await withRetry(async () => {
              await chrome.bookmarks.move(bookmark.id, {
                parentId: categoryFolder.id
              });
            }, `Move-Bookmark-${bookmark.id}`, 2);
            
            organizationResult.organized++;
          } catch (moveError) {
            const error = `Failed to move bookmark "${bookmark.title}": ${moveError.message}`;
            organizationResult.errors.push(error);
            organizationResult.partialSuccess = true;
            logError('Bookmark-Move', moveError, { bookmark });
          }
        }
      } catch (categoryError) {
        const error = `Failed to create category "${categoryName}": ${categoryError.message}`;
        organizationResult.errors.push(error);
        organizationResult.partialSuccess = true;
        logError('Category-Creation', categoryError, { categoryName });
      }
    }

    // Remove broken bookmarks if setting is enabled
    if (settings.autoRemoveBroken) {
      for (const brokenBookmark of brokenBookmarks) {
        try {
          await withRetry(async () => {
            await chrome.bookmarks.remove(brokenBookmark.id);
          }, `Remove-Broken-${brokenBookmark.id}`, 2);
          
          organizationResult.removed++;
        } catch (removeError) {
          const error = `Failed to remove broken bookmark "${brokenBookmark.title}": ${removeError.message}`;
          organizationResult.errors.push(error);
          organizationResult.partialSuccess = true;
          logError('Bookmark-Removal', removeError, { brokenBookmark });
        }
      }
    }

    // Determine final success status
    if (organizationResult.errors.length > 0) {
      organizationResult.success = organizationResult.organized > 0 || organizationResult.removed > 0;
    }

    return organizationResult;

  } catch (error) {
    logError('Organization-Process', error, { categorizedBookmarks, brokenBookmarks, settings });
    return {
      success: false,
      organized: organizationResult.organized,
      removed: organizationResult.removed,
      error: error.message,
      errors: organizationResult.errors
    };
  }
}