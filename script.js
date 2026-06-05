// Конфигурация API (Вставьте сюда ваш рабочий токен OpenWeather API)
const API_KEY = "ВАШ_API_KEY_ИЗ_OPENWEATHER"; 
const WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";

// DOM Элементы
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const geoBtn = document.getElementById('geo-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const loader = document.getElementById('loader');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const weatherContent = document.getElementById('weather-content');
const historyContainer = document.getElementById('search-history');

// Элементы вывода данных
const cityName = document.getElementById('city-name');
const countryCode = document.getElementById('country-code');
const lastUpdate = document.getElementById('last-update');
const weatherIcon = document.getElementById('weather-icon');
const mainTemp = document.getElementById('main-temp');
const weatherDesc = document.getElementById('weather-desc');
const feelsLike = document.getElementById('feels-like');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');
const pressure = document.getElementById('pressure');
const forecastContainer = document.getElementById('forecast-container');

// Иконки погоды по кодам состояний
const weatherEmojis = {
    Clear: "☀️",
    Clouds: "☁️",
    Rain: "🌧",
    Drizzle: "🌦",
    Thunderstorm: "⛈",
    Snow: "❄️",
    Mist: "🌫",
    Smoke: "🌫",
    Haze: "🌫",
    Dust: "🌫",
    Fog: "🌫"
};

let searchHistory = JSON.parse(localStorage.getItem('weather_history')) || [];

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderHistory();
    // Если в истории что-то есть, загружаем последний город, иначе Dushanbe
    const defaultCity = searchHistory.length > 0 ? searchHistory[0] : "Dushanbe";
    getWeatherData(defaultCity);
});

// --- Работа с темой (Dark/Light) ---
function initTheme() {
    const savedTheme = localStorage.getItem('weather_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeIcon.textContent = savedTheme === 'dark' ? 'light_mode' : 'dark_mode';
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('weather_theme', newTheme);
    themeIcon.textContent = newTheme === 'dark' ? 'light_mode' : 'dark_mode';
    
    // Обновляем фон, так как ночь привязана к теме
    updateBackground(document.body.dataset.weatherCondition);
});

// --- Обновление градиента фона ---
function updateBackground(condition) {
    document.body.className = ''; // Сброс классов
    document.body.dataset.weatherCondition = condition; // Сохраняем состояние

    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

    if (isDarkTheme) {
        document.body.classList.add('bg-night');
        return;
    }

    switch(condition) {
        case 'Clear': document.body.classList.add('bg-clear'); break;
        case 'Rain': case 'Drizzle': case 'Thunderstorm': document.body.classList.add('bg-rain'); break;
        case 'Clouds': document.body.classList.add('bg-clouds'); break;
        case 'Snow': document.body.classList.add('bg-snow'); break;
        default: document.body.classList.add('bg-clouds');
    }
}

// --- Получение данных о погоде ---
async function getWeatherData(query, isCoords = false) {
    showLoader(true);
    showError(false);

    if (!window.navigator.onLine) {
        showError(true, "Connection error. Please check your internet.");
        showLoader(false);
        return;
    }

    try {
        let currentUrl, forecastUrl;

        if (isCoords) {
            currentUrl = `${WEATHER_BASE_URL}?lat=${query.lat}&lon=${query.lon}&units=metric&appid=${API_KEY}`;
            forecastUrl = `${FORECAST_BASE_URL}?lat=${query.lat}&lon=${query.lon}&units=metric&appid=${API_KEY}`;
        } else {
            if (!query.trim()) {
                showError(true, "Please enter a city name");
                showLoader(false);
                return;
            }
            currentUrl = `${WEATHER_BASE_URL}?q=${encodeURIComponent(query)}&units=metric&appid=${API_KEY}`;
            forecastUrl = `${FORECAST_BASE_URL}?q=${encodeURIComponent(query)}&units=metric&appid=${API_KEY}`;
        }

        // Выполняем запросы параллельно для скорости
        const [currentRes, forecastRes] = await Promise.all([
            fetch(currentUrl),
            fetch(forecastUrl)
        ]);

        if (currentRes.status === 404) {
            showError(true, "City not found");
            showLoader(false);
            return;
        }

        if (!currentRes.ok || !forecastRes.ok) {
            throw new Error("API Error");
        }

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        displayCurrentWeather(currentData);
        displayForecast(forecastData);
        
        if (!isCoords) {
            saveToHistory(currentData.name);
        }

        weatherContent.classList.remove('hidden');
    } catch (err) {
        showError(true, "An error occurred while fetching data.");
    } finally {
        showLoader(false);
    }
}

// --- Отображение текущей погоды ---
function displayCurrentWeather(data) {
    const condition = data.weather[0].main;
    
    cityName.textContent = data.name;
    countryCode.textContent = data.sys.country;
    mainTemp.textContent = Math.round(data.main.temp);
    feelsLike.textContent = `${Math.round(data.main.feels_like)}°C`;
    humidity.textContent = `${data.main.humidity}%`;
    windSpeed.textContent = `${data.wind.speed} m/s`;
    pressure.textContent = `${data.main.pressure} hPa`;
    weatherDesc.textContent = data.weather[0].description;
    
    weatherIcon.textContent = weatherEmojis[condition] || "✨";
    
    // Время обновления
    const now = new Date();
    lastUpdate.textContent = `Last updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

    updateBackground(condition);
}

// --- Отображение прогноза на 5 дней ---
function displayForecast(data) {
    forecastContainer.innerHTML = '';
    
    // Фильтруем шаги API (OpenWeather возвращает данные каждые 3 часа). 
    // Нам нужен 1 замер в день (например, в 12:00).
    const dailyData = data.list.filter(item => item.dt_txt.includes("12:00:00"));

    dailyData.forEach(day => {
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const condition = day.weather[0].main;
        const emoji = weatherEmojis[condition] || "✨";
        const temp = Math.round(day.main.temp);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <p class="forecast-day">${dayName}</p>
            <span class="forecast-emoji">${emoji}</span>
            <p class="forecast-temp">${temp}°C</p>
        `;
        forecastContainer.appendChild(card);
    });
}

// --- Управление Историей Поиска ---
function saveToHistory(city) {
    // Удаляем дубликат, если есть
    searchHistory = searchHistory.filter(c => c.toLowerCase() !== city.toLowerCase());
    // Добавляем в начало
    searchHistory.unshift(city);
    // Ограничиваем 5 городами
    if (searchHistory.length > 5) searchHistory.pop();
    
    localStorage.setItem('weather_history', JSON.stringify(searchHistory));
    renderHistory();
}

function renderHistory() {
    historyContainer.innerHTML = '';
    searchHistory.forEach(city => {
        const tag = document.createElement('span');
        tag.className = 'history-tag';
        tag.textContent = city;
        tag.addEventListener('click', () => {
            cityInput.value = city;
            getWeatherData(city);
        });
        historyContainer.appendChild(tag);
    });
}

// --- Переключатели Лоадера и Ошибок ---
function showLoader(show) {
    if (show) {
        loader.classList.remove('hidden');
        weatherContent.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

function showError(show, message = "") {
    if (show) {
        errorMessage.textContent = message;
        errorBox.classList.remove('hidden');
        weatherContent.classList.add('hidden');
    } else {
        errorBox.classList.add('hidden');
    }
}

// --- Слушатели Событий ---
searchBtn.addEventListener('click', () => {
    getWeatherData(cityInput.value);
});

cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') getWeatherData(cityInput.value);
});

geoBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        showLoader(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                getWeatherData(coords, true);
                cityInput.value = ""; // Очищаем инпут при геопозиции
            },
            () => {
                showError(true, "Location access denied.");
                showLoader(false);
            }
        );
    } else {
        showError(true, "Geolocation is not supported by your browser.");
    }
});