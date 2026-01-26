const LOCAL_STORAGE_KEY = 'DOG_API_KEY';

function getApiKey() {
    let key = localStorage.getItem(LOCAL_STORAGE_KEY);
    
    if (!key) {
        key = prompt("Enter Dog API Key (it stays in your browser's local storage):");
        
        if (key) {
            localStorage.setItem(LOCAL_STORAGE_KEY, key);
        }
    }
    return key;
}

async function fetchBreeds(apiKey) {
    const URL = 'https://api.thedogapi.com/v1/breeds?limit=10';
    const response = await fetch(URL, {
        method: 'GET',
        headers: { 'x-api-key': apiKey }
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
}

async function loadBreeds() {
    const API_KEY = getApiKey();

    if (!API_KEY) {
        console.error('No API KEY Found. Refresh and Enter A Valid API Key');
        return;
    }

    try {
        const dogData = await fetchBreeds(API_KEY);
        
        populateDogData(dogData);

    } catch (error) {
        console.error(error);
        alert(`Something went wrong: ${error.message}`);
    }
}

const deleteApiButton = document.getElementById('delete-btn');
deleteApiButton.addEventListener('click', () => {
    if (confirm('Delete stored API key?')) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        location.reload();
    }
});

function populateDogData(dogData) {
    const dogContainer = document.getElementById('dog-container');
    const dogList = dogContainer.querySelector('ul');
    for (const dog of dogData) {
        const dogBreed = document.createElement('li');
        dogBreed.textContent = dog.name;
        dogList.appendChild(dogBreed);
    }
}

loadBreeds();