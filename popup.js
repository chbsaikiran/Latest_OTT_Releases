const NETFLIX_PROVIDER_ID = 8;
const PRIME_VIDEO_PROVIDER_ID = 119;
const HOTSTAR_PROVIDER_ID = 122;
const HINDI_LANGUAGE_CODE = 'hi';
const TELUGU_LANGUAGE_CODE = 'te';
const ENGLISH_LANGUAGE_CODE = 'en';
const ENCRYPTION_KEY = 'NetflixReleases';
const MAX_LOOKBACK_DAYS = 365; // 10 years
const MAX_PAGES = 20; // Increase the number of pages we fetch
const OMDB_API_KEY = 'OMDBAPIKEYHERE'; // Replace with your OMDb API key
const IMDB_BASE_URL = 'https://www.imdb.com/title/';

function decrypt(encryptedText, key) {
  const text = atob(encryptedText);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

let TMDB_API_KEY = 'TMDBAPIKEYHERE'

function getDateRange(days) {
  const today = new Date();
  const startDate = new Date(today.getTime() - Math.min(days, MAX_LOOKBACK_DAYS) * 24 * 60 * 60 * 1000);
  return {
    start: startDate.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  };
}

async function fetchOTTReleases(languageCode, mediaType, days, providerId) {
  const dateRange = getDateRange(days);
  let allResults = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    let url = `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${TMDB_API_KEY}&with_watch_providers=${providerId}&watch_region=IN&sort_by=release_date.desc&page=${page}&with_watch_monetization_types=flatrate`;
    
    if (mediaType === 'movie') {
      url += `&primary_release_date.gte=${dateRange.start}&primary_release_date.lte=${dateRange.end}`;
    } else {
      url += `&first_air_date.gte=${dateRange.start}&first_air_date.lte=${dateRange.end}`;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Filter results based on the original language
      const filteredResults = data.results.filter(item => item.original_language === languageCode);
      
      // After filtering the results, fetch IMDb IDs for each item
      const resultsWithImdbIds = await Promise.all(
        filteredResults.map(async (item) => {
          const imdbId = await fetchImdbId(item.id, mediaType);
          return { ...item, imdbId };
        })
      );

      allResults = allResults.concat(resultsWithImdbIds);
      
      if (page >= data.total_pages) break;
    } catch (error) {
      console.error(`Error fetching ${languageCode} ${mediaType} data:`, error);
      throw error;
    }
  }

  console.log(`Total results for ${languageCode} ${mediaType}:`, allResults.length);
  return allResults;
}

async function fetchImdbId(tmdbId, mediaType) {
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.imdb_id;
  } catch (error) {
    console.error(`Error fetching IMDb ID for TMDB ID ${tmdbId}:`, error);
    return null;
  }
}

async function displayReleases(releases, language, mediaType, days, ottPlatform) {
  const releasesList = document.getElementById(`${language}-${mediaType}`);
  if (!releasesList) {
    console.error(`Element with id '${language}-${mediaType}' not found`);
    return;
  }

  releasesList.innerHTML = '';

  if (releases.length === 0) {
    releasesList.innerHTML = `<li>No ${language} ${mediaType} found on ${ottPlatform} for the specified period.</li>`;
    return;
  }

  console.log(`Displaying ${releases.length} ${language} ${mediaType} releases`);
  
  const dateRange = getDateRange(days);
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  // Sort releases from latest to oldest
  releases.sort((a, b) => {
    const dateA = new Date(a.release_date || a.first_air_date);
    const dateB = new Date(b.release_date || b.first_air_date);
    return dateB - dateA;
  });

  releases.forEach((release) => {
    const releaseDate = new Date(release.release_date || release.first_air_date);
    if (releaseDate >= startDate && releaseDate <= endDate) {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${release.title || release.name}</strong><br>
        Release Date: ${releaseDate.toLocaleDateString()} | 
        TMDB Rating: ${release.vote_average.toFixed(1)}/10 
        <a href="${IMDB_BASE_URL}${release.imdbId}" target="_blank">(View on IMDb)</a>
      `;
      releasesList.appendChild(li);
    }
  });
}

function displayError(message) {
  const languages = ['hindi', 'telugu', 'english'];
  const mediaTypes = ['movie', 'tv'];
  
  languages.forEach(lang => {
    mediaTypes.forEach(type => {
      const elementId = `${lang}-${type}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.innerHTML = `<li style="color: red;">${message}</li>`;
      } else {
        console.error(`Element with id '${elementId}' not found`);
      }
    });
  });
}

async function fetchAndDisplayReleases(days, ottPlatform) {
  try {
    console.log('API Key being used:', TMDB_API_KEY);
    console.log('Fetching releases for the last', days, 'days from', ottPlatform);
    
    const languages = [
      { code: HINDI_LANGUAGE_CODE, name: 'hindi' },
      { code: TELUGU_LANGUAGE_CODE, name: 'telugu' },
      { code: ENGLISH_LANGUAGE_CODE, name: 'english' }
    ];
    const mediaTypes = ['movie', 'tv'];

    let providerId;
    switch (ottPlatform) {
      case 'Netflix':
        providerId = NETFLIX_PROVIDER_ID;
        break;
      case 'Prime Video':
        providerId = PRIME_VIDEO_PROVIDER_ID;
        break;
      case 'Hotstar':
        providerId = HOTSTAR_PROVIDER_ID;
        break;
      default:
        throw new Error('Invalid OTT platform selected');
    }

    for (const lang of languages) {
      for (const mediaType of mediaTypes) {
        try {
          const releases = await fetchOTTReleases(lang.code, mediaType, days, providerId);
          console.log(`Fetched ${lang.name} ${mediaType} releases from ${ottPlatform}:`, releases);
          // Log the language codes of fetched releases
          console.log(`Language codes for ${lang.name} ${mediaType}:`, releases.map(r => r.original_language));
          displayReleases(releases, lang.name, mediaType, days, ottPlatform);
        } catch (error) {
          console.error(`Error fetching ${lang.name} ${mediaType} releases from ${ottPlatform}:`, error);
          displayError(`Failed to fetch ${lang.name} ${mediaType} releases from ${ottPlatform}. ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in main execution:', error);
    displayError('An error occurred while fetching releases. Please try again later.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const daysInput = document.getElementById('days-input');
  const fetchButton = document.getElementById('fetch-button');
  const ottSelect = document.getElementById('ott-select');

  if (!ottSelect) {
    console.error('OTT select element not found. Using default value.');
  } else {
    console.log('OTT select element found:', ottSelect);
  }

  chrome.storage.sync.get(['days', 'ottPlatform'], (result) => {
    if (result.days) {
      daysInput.value = result.days;
    }
    if (result.ottPlatform && ottSelect) {
      ottSelect.value = result.ottPlatform;
    } else if (ottSelect) {
      // Set default value to Netflix if not previously set
      ottSelect.value = 'Netflix';
    }
    const initialOttPlatform = ottSelect ? ottSelect.value : 'Netflix';
    console.log('Initial OTT Platform:', initialOttPlatform);
    fetchAndDisplayReleases(parseInt(daysInput.value, 10) || 365, initialOttPlatform);
  });

  if (ottSelect) {
    ottSelect.addEventListener('change', (event) => {
      console.log('OTT Platform changed to:', event.target.value);
    });
  }

  fetchButton.addEventListener('click', () => {
    const days = Math.min(parseInt(daysInput.value, 10) || 365, MAX_LOOKBACK_DAYS);
    const ottPlatform = ottSelect ? ottSelect.value : 'Netflix';
    daysInput.value = days; // Update input value if it exceeds max
    chrome.storage.sync.set({ days: days, ottPlatform: ottPlatform }, () => {
      console.log('Days value saved:', days);
      console.log('OTT Platform saved:', ottPlatform);
    });
    fetchAndDisplayReleases(days, ottPlatform);
  });
});

// Remove or comment out the getApiKey and setApiKey functions, as we're not using them anymore




