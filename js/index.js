// --- API KEY MANAGEMENT ---
// saves the key so the user doesn't have to re-enter it every time

const STORAGE_KEY = 'PUP_FINDER_API_KEY';
const API_KEY_PROMPT_DELAY_MS = 500;
const CDN_BASE_URL = 'https://cdn2.thedogapi.com/images/'; // fallback for missing image URLs
const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\' viewBox=\'0 0 800 600\'%3E%3Crect fill=\'%23f3f4f6\' width=\'800\' height=\'600\'/%3E%3Ctext fill=\'%239ca3af\' font-family=\'sans-serif\' font-size=\'60\' dy=\'20\' font-weight=\'bold\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\'%3ENo Image%3C/text%3E%3C/svg%3E'; // shown when no image exists

// checks localStorage first — only prompts the user if there's nothing saved
function getApiKey() {
    let key = localStorage.getItem(STORAGE_KEY);

    if (!key) {
        key = prompt('Please enter your Dog API key (it will be saved in your browser):');
        key = key?.trim(); // ?. prevents a crash if the user hits cancel

        if (key) {
            localStorage.setItem(STORAGE_KEY, key);
        }
    }

    return key;
}

// ask to confirm before wiping the key, then reload so everything resets
function deleteApiKey() {
    if (confirm('Are you sure you want to delete your saved API key?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

// the delete button exists in both the desktop header and mobile menu
const deleteKeyButtons = document.querySelectorAll('.delete-key');
deleteKeyButtons.forEach(btn => btn.addEventListener('click', deleteApiKey));


// --- DARK / LIGHT MODE ---

const html = document.documentElement; // targeting <html> so the class applies globally
const themeToggle = document.querySelectorAll('.theme-toggle');

// keep the icon in sync with whatever mode is active
function updateThemeIcon() {
    const isDark = html.classList.contains('dark');
    const icon = isDark ? '☀️' : '🌙';
    themeToggle.forEach(btn => btn.textContent = icon);
}

updateThemeIcon(); // run once on load so the icon isn't wrong on first render

function toggleTheme() {
    html.classList.toggle('dark');
    updateThemeIcon();
}

themeToggle.forEach(btn => btn.addEventListener('click', toggleTheme));


// --- API FETCH FUNCTIONS ---

// all API calls go through here so I'm not copy-pasting the fetch setup everywhere
async function callApi(path, apiKey) {
    const response = await fetch(`https://api.thedogapi.com/v1${path}`, {
        headers: { 'x-api-key': apiKey }
    });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
}

function searchBreeds(apiKey, query) {
    return callApi(`/breeds/search?q=${encodeURIComponent(query)}`, apiKey); // encodeURIComponent makes the text URL-safe
}

// used for the Browse All page
function getAllBreeds(apiKey) {
    return callApi('/breeds', apiKey);
}

function getDogImage(apiKey, imageId) {
    if (!imageId) {
        throw new Error('No image ID');
    }
    return callApi(`/images/${encodeURIComponent(imageId)}`, apiKey);
}


// --- STAT FORMATTING ---

// adds the unit label and splits male/female measurements onto separate lines
function formatMeasurement(value, unit) {
    if (!value) return '-';

    const container = document.createElement('span');
    const lowerValue = value.toLowerCase();

    if (lowerValue.includes('male') && lowerValue.includes('female')) {
        const measures = value.split(/[,;]/);

        measures.forEach((measure, index) => {
            if (index > 0) container.appendChild(document.createElement('br'));
            container.append(`${measure.trim()} ${unit}`);
        });
    } else {
        container.textContent = `${value.trim()} ${unit}`;
    }

    return container;
}

// adds "years" if it's not already in the string
function formatLifespan(value) {
    if (!value) return '-';
    const str = value.trim();
    return str.toLowerCase().includes('year') ? str : `${str} years`;
}

// splits the temperament string by commas and turns each trait into a chip element
function buildTemperamentChips(value) {
    const container = document.createElement('div');
    container.classList.add('trait-chips');

    if (!value) {
        container.textContent = '-';
        return container;
    }

    value.split(',').forEach(trait => {
        const chip = document.createElement('span');
        chip.classList.add('trait-chip');
        chip.textContent = trait.trim();
        if (chip.textContent) container.appendChild(chip);
    });

    return container;
}


// --- SEARCH FEATURE ---

const SEARCH_DEBOUNCE_MS = 300;
const searchPopup = document.getElementById('search-popup');
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('btn-clear');
const resultsList = document.getElementById('results-list');
const noResults = document.getElementById('no-results');
const searchBtn = document.getElementById('btn-search-open');

// open the popup and focus the input, or close it if it's already open
searchBtn.addEventListener('click', () => {
    if (searchPopup.hidden) {
        searchPopup.hidden = false;
        searchInput.focus();
    } else {
        searchPopup.hidden = true;
    }
});

// close the popup if the user clicks anywhere outside of it
function closeSearchOnClickOutside(e) {
    if (!searchPopup.hidden) {
        if (!searchPopup.contains(e.target) && !searchBtn.contains(e.target)) {
            searchPopup.hidden = true;
        }
    }
}

document.addEventListener('click', closeSearchOnClickOutside);

let searchDebounceTimer; // holds the timer so I can reset it on each keystroke

searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    clearTimeout(searchDebounceTimer); // cancel the previous timer so it doesn't fire early

    if (query === '') {
        clearBtn.hidden = true;
        showResults([]);
        return;
    }

    clearBtn.hidden = false;

    // wait 300ms after the user stops typing before hitting the API
    // avoids spamming a request on every single keystroke
    searchDebounceTimer = setTimeout(async () => {
        const apiKey = getApiKey();
        if (!apiKey) return;

        try {
            const breeds = await searchBreeds(apiKey, query);
            showResults(breeds);
        } catch (err) {
            console.error('Search error:', err);
        }
    }, SEARCH_DEBOUNCE_MS);
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    clearBtn.hidden = true;
    showResults([]);
});

function showResults(breeds) {
    resultsList.replaceChildren(); // wipe old results before rendering new ones

    if (breeds.length === 0) {
        const query = searchInput.value.trim();
        if (query.length > 0) {
            noResults.textContent = 'No breeds found — try a different name.';
            noResults.hidden = false;
        } else {
            noResults.hidden = true;
        }
        return;
    }

    noResults.hidden = true;

    breeds.forEach(breed => {
        const item = document.createElement('li');
        item.textContent = breed.name;
        item.tabIndex = 0; // needed so keyboard users can Tab to each result

        function selectBreed() {
            switchPage('home');
            showBreedProfile(breed);
            searchPopup.hidden = true;
            searchInput.value = '';
            clearBtn.hidden = true;
            showResults([]);
        }

        item.addEventListener('click', selectBreed);
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter') selectBreed();
        });

        resultsList.appendChild(item);
    });
}


// --- DOG PROFILE ---

const MAX_FONT_SIZE = 120;
const FONT_SIZE_DIVISOR = 160;
const MIN_NAME_LENGTH = 3;
const MIN_BG_FONT_SIZE = '1rem';
const MAX_BG_FONT_SIZE = '10rem';

let activeBreedId = null; // tracks which breed is open so a slow fetch doesn't overwrite a newer one

// builds out the profile section for the selected breed
// preloadedImg comes from the Browse card so the photo shows instantly before the full fetch finishes
async function showBreedProfile(breed, preloadedImg = null) {
    activeBreedId = breed.id;

    const welcomeMessage = document.getElementById('welcome-msg');
    const profileSection = document.getElementById('dog-profile');

    welcomeMessage.hidden = true;
    profileSection.hidden = false;

    // background word behind the profile — font scales down for longer names
    const bgWord = document.getElementById('bg-word');
    bgWord.textContent = breed.name;

    const size = Math.min(MAX_FONT_SIZE, FONT_SIZE_DIVISOR / Math.max(breed.name.length, MIN_NAME_LENGTH));
    bgWord.style.fontSize = `clamp(${MIN_BG_FONT_SIZE}, ${size}vw, ${MAX_BG_FONT_SIZE})`;

    // fill in all the text stats
    const name = document.getElementById('breed-name');
    const origin = document.getElementById('stat-origin');
    const description = document.getElementById('stat-description');
    const history = document.getElementById('stat-history');
    const group = document.getElementById('stat-group');

    name.textContent = breed.name;
    origin.textContent = breed.origin || 'Unknown';
    description.textContent = breed.description || 'No description available.';
    history.textContent = breed.history || breed.bred_for || 'Unknown';
    group.textContent = breed.breed_group || 'Unknown';

    const lifeSpan = document.getElementById('stat-lifespan');
    const height = document.getElementById('stat-height');
    const weight = document.getElementById('stat-weight');
    const temperament = document.getElementById('stat-temperament');

    lifeSpan.replaceChildren(formatLifespan(breed.life_span));
    height.replaceChildren(formatMeasurement(breed.height?.imperial, 'in'));
    weight.replaceChildren(formatMeasurement(breed.weight?.imperial, 'lbs'));
    temperament.replaceChildren(buildTemperamentChips(breed.temperament));

    const dogPhoto = document.getElementById('dog-photo');
    const loadingText = document.getElementById('photo-loading');

    // reset the photo area before loading anything new
    dogPhoto.style.display = 'none';
    loadingText.style.display = 'block';
    loadingText.textContent = 'Loading...';

    // if we got a thumbnail from the Browse page, show it right away as a preview
    if (preloadedImg) {
        dogPhoto.src = preloadedImg;
        dogPhoto.alt = breed.name;
        dogPhoto.style.display = 'block';
        loadingText.style.display = 'none';
    }

    // then fetch the full-res version from the API
    try {
        const apiKey = getApiKey();

        if (breed.reference_image_id) {
            const image = await getDogImage(apiKey, breed.reference_image_id);

            // make sure the user hasn't already clicked a different breed while this was loading
            if (activeBreedId === breed.id) {
                dogPhoto.src = image.url;
                dogPhoto.alt = breed.name;
                dogPhoto.style.display = 'block';
                loadingText.style.display = 'none';
            }
        }
    } catch (error) {
        console.error(error);

        if (activeBreedId === breed.id) {
            if (!preloadedImg) {
                dogPhoto.style.display = 'none';
                loadingText.style.display = 'block';
                loadingText.textContent = 'Image not available';
            } else {
                loadingText.style.display = 'none'; // keep the preloaded thumbnail as a fallback
            }
        }
    }
}


// --- PAGE SWITCHING ---

const homePage = document.getElementById('home-page');
const browsePage = document.getElementById('browse-page');
const breedsGrid = document.getElementById('breeds-grid');
const navButtons = document.querySelectorAll('.nav-link');

let browseSavedScrollPosition = 0;

function switchPage(pageName) {
    if (pageName === 'home') {
        if (!browsePage.hidden) {
            browseSavedScrollPosition = window.scrollY; // save position before leaving Browse
        }

        homePage.hidden = false;
        browsePage.hidden = true;
        window.scrollTo(0, 0);
    } else {
        homePage.hidden = true;
        browsePage.hidden = false;

        // only build the grid once — skip if cards are already there
        if (breedsGrid.children.length === 0) buildBreedGrid();

        window.scrollTo(0, browseSavedScrollPosition); // restore where they left off
    }

    // highlight the active nav button
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageName);
    });
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
});


// --- MOBILE MENU TOGGLE ---

const menuBtn = document.getElementById('btn-menu');
const mobileDropdown = document.getElementById('mobile-dropdown');

function closeMobileMenu() {
    menuBtn.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Open menu');
    mobileDropdown.classList.remove('open');
    mobileDropdown.setAttribute('aria-hidden', 'true');
}

menuBtn.addEventListener('click', () => {
    const isOpen = mobileDropdown.classList.contains('open');

    if (isOpen) {
        closeMobileMenu();
    } else {
        menuBtn.classList.add('open');
        menuBtn.setAttribute('aria-expanded', 'true');
        menuBtn.setAttribute('aria-label', 'Close menu');
        mobileDropdown.classList.add('open');
        mobileDropdown.setAttribute('aria-hidden', 'false');
    }
});

// close the menu if the user clicks outside of it
function closeMenuOnClickOutside(e) {
    if (mobileDropdown.classList.contains('open')) {
        if (!mobileDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
            closeMobileMenu();
        }
    }
}

document.addEventListener('click', closeMenuOnClickOutside);


// --- BREED CARD GRID (Browse page) ---

const CARD_ANIMATION_DELAY_MS = 30;

async function buildBreedGrid() {
    const apiKey = getApiKey();

    // show a loading message while waiting on the API
    breedsGrid.replaceChildren();
    const loadingMessage = document.createElement('p');
    loadingMessage.textContent = 'Loading breeds...';
    loadingMessage.style.textAlign = 'center';
    loadingMessage.style.width = '100%';
    breedsGrid.appendChild(loadingMessage);

    try {
        const allBreeds = await getAllBreeds(apiKey);
        breedsGrid.replaceChildren(); // clear the loading message

        // only show breeds that have an image to display
        const visibleBreeds = allBreeds.filter(breed => breed.reference_image_id);

        visibleBreeds.forEach((breed, index) => {
            const imageUrl = breed.image?.url || `${CDN_BASE_URL}${breed.reference_image_id}.jpg`; // use CDN as fallback

            const card = document.createElement('div');
            card.classList.add('breed-card', 'show-card');
            card.style.animationDelay = `${index * CARD_ANIMATION_DELAY_MS}ms`; // stagger the cards

            // remove the animation class after it's done so it doesn't replay when switching pages
            card.addEventListener('animationend', () => {
                card.classList.remove('show-card');
                card.style.animationDelay = '';
            });

            card.tabIndex = 0;

            const photo = document.createElement('img');
            photo.loading = 'lazy'; // don't load until it's close to the viewport
            photo.decoding = 'async'; // decode in the background to reduce jank

            // if the image fails, swap in the placeholder instead of breaking the card
            photo.addEventListener('error', () => {
                console.warn(`Failed to load image for ${breed.name}`);
                photo.src = PLACEHOLDER_IMG;
            });

            photo.src = imageUrl;
            photo.alt = breed.name;
            photo.classList.add('card-photo');

            const label = document.createElement('h3');
            label.classList.add('card-name');
            label.textContent = breed.name;

            card.appendChild(photo);
            card.appendChild(label);

            // goes to the home page and loads the full profile
            function openProfile() {
                switchPage('home');
                showBreedProfile(breed, imageUrl); // passing the card image for an instant preview
            }

            async function animateOpen() {
                if (document.startViewTransition) {
                    const profileHero = document.getElementById('dog-photo');

                    try {
                        // link the card image to the profile image for the transition
                        photo.style.viewTransitionName = 'hero-image';
                        profileHero.style.viewTransitionName = 'hero-image';

                        const transition = document.startViewTransition(openProfile);
                        await transition.finished; // wait for the animation to complete

                    } catch (error) {
                        console.error('View transition failed:', error);
                        // if the transition crashes, still open the profile
                        if (homePage.hidden) openProfile();
                    } finally {
                        // always clean up the transition name when done
                        photo.style.viewTransitionName = '';
                        profileHero.style.viewTransitionName = '';
                    }
                } else {
                    openProfile(); // browser doesn't support View Transitions, just open normally
                }
            }

            card.addEventListener('click', animateOpen);
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter') animateOpen();
            });

            breedsGrid.appendChild(card);
        });

    } catch (error) {
        console.error(error);

        breedsGrid.replaceChildren();
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'Could not load breeds. Please check your API key.';
        errorMessage.style.textAlign = 'center';
        breedsGrid.appendChild(errorMessage);
    }
}

// small delay before prompting for the key so the page finishes rendering first
setTimeout(getApiKey, API_KEY_PROMPT_DELAY_MS);
