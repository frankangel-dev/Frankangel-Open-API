const LOCAL_STORAGE_KEY = 'DOG_API_KEY'; // API Key Name

// Store API Key In Browser
function getApiKey() {
    let key = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (!key) {
        key = prompt("Enter Dog API Key (it stays in your browser's local storage):");

        key = key?.trim();
        if (key) {
            localStorage.setItem(LOCAL_STORAGE_KEY, key);
        }
    }
    return key;
}

// Fetch Breed Api
async function fetchBreeds(apiKey, breedName) {
    const url = new URL('https://api.thedogapi.com/v1/breeds/search');
    url.searchParams.append('q', breedName);

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'x-api-key': apiKey }
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    return await response.json();
}

// Fetch Image API
async function fetchImage(apiKey, imageId){
    if (!imageId) {
        throw new Error('No Image ID Found');
    }

    const response = await fetch(`https://api.thedogapi.com/v1/images/${encodeURIComponent(imageId)}`, {
        headers: {
            'x-api-key': apiKey
        }
    });

    if (!response.ok) {
        throw new Error(`API Image Error: ${response.status}`);
    }
    return await response.json();
}


// Load Breeds W/ Search Button
async function loadBreeds(breedName) {
    const API_KEY = getApiKey();

    if (!API_KEY) {
        console.error('No API KEY Found. Refresh and Enter A Valid API Key');
        return;
    }

    try {
        let dogData = await fetchBreeds(API_KEY, breedName);

        populateDogData(dogData);

    } catch (error) {
        console.error(error);
        alert(`Something went wrong: ${error.message}`);
    }
}

// Delete Button
const deleteApiButton = document.getElementById('delete-btn');
deleteApiButton.addEventListener('click', () => {
    if (confirm('Delete stored API key?')) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        location.reload();
    }
});

// Populate Breed List After Search
function populateDogData(dogData) {
    const dogList = document.getElementById('breed-list');
    const empty = document.getElementById('empty-state');
    dogList.replaceChildren();

    if (dogData.length === 0) {
        empty.style.display = 'block';
        empty.textContent = 'No Dogs Available';
    } else {
        empty.style.display = 'none';
        for (const dog of dogData) {
            const dogBreed = document.createElement('li');
            dogBreed.textContent = dog.name;
            dogBreed.addEventListener('click', () => showBreedProfile(dog));
            dogList.appendChild(dogBreed);
        }
    }
}

// Show Breed Profile After Clicking From List
async function showBreedProfile(dog) {
    const dogBreed = document.getElementById('breed-name');
    const description = document.getElementById('stat-description');
    const lifeSpan = document.getElementById('stat-life');
    const temp = document.getElementById('stat-temp');
    const imageBox = document.querySelector('.image-box');
    let dogImage = document.getElementById('dog-img');
    const textPlaceholder = document.getElementById('text-placeholder');
    const breedImageId = dog.reference_image_id;
    dogBreed.textContent = dog.name;
    description.textContent = dog.description;
    lifeSpan.textContent = dog.life_span;
    temp.textContent = dog.temperament;

    // Loading Transition
    if (dogImage) {
        dogImage.style.display = 'none';
    }
    textPlaceholder.style.display = 'block';
    textPlaceholder.textContent = 'Loading...';

    try {
        const apiKey = getApiKey();
        const dogImageData = await fetchImage(apiKey, breedImageId);

        if (!dogImage) {
            dogImage = document.createElement('img');
            dogImage.id = 'dog-img';
            imageBox.insertBefore(dogImage, textPlaceholder);
        }

        dogImage.src = dogImageData.url;
        dogImage.alt = dog.name;
        dogImage.style.display = 'block';
        textPlaceholder.style.display = 'none';
    } catch (error) {
        console.error(error);
        if (dogImage) {
            dogImage.style.display = 'none';
        }
        textPlaceholder.style.display = 'block';
        textPlaceholder.textContent = 'Image Unavailable';
    }
}

// Search Button
const searchButton = document.getElementById('fetch-breeds-btn');
const searchInput = document.getElementById('search-name');

searchButton.addEventListener('click', () => {
    const breedName = searchInput.value.trim();
    searchInput.style.borderColor = '';

    if (!breedName) {
        searchInput.style.borderColor = 'var(--danger)';
        return;
    }
    
    loadBreeds(breedName);
});

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        searchButton.click();
    }
});

// Dark Mode Toggle
const html = document.documentElement;
const themeButton = document.getElementById('theme-btn');
const themeKey = localStorage.getItem('theme');

if (themeKey === 'dark') {
    html.classList.add('dark-mode');
    themeButton.textContent = '☀️';
}

themeButton.addEventListener('click', () => {
    html.classList.toggle('dark-mode');
    const isDarkMode = html.classList.contains('dark-mode');

    themeButton.textContent = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
});

// Prompt API Key On Load
setTimeout(getApiKey, 500);