const mineflayer = require('mineflayer');
const path = require('path');

process.stdout.setEncoding('utf8');

// --- 1. ОЧИСТИТЕЛЬ МУСОРА КОНСОЛИ ---
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string') {
    const ignore = ['Ignoring block entities', 'Intensive server activity', 'Invalid move', 'resource_pack_receive'];
    if (ignore.some(phrase => chunk.includes(phrase))) return true;
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

const loadedModules = {};

// Жестко задаем настройки без readline опросов
const BOT_USERNAME = 'trezub_pena';

const bot = mineflayer.createBot({
  host: 'mc.reallyworld.me',
  username: BOT_USERNAME,
  version: '1.20.1'
});

bot._username = BOT_USERNAME;
bot.alreadyLogged = false;
let antiAfkInterval = null;
let joinTimer = null; // Таймер для бесконечного захода на гриф-30

bot.on('resourcePack', () => {
  console.log('\x1b[35m[Система] Сервер предложил ресурспак. Принимаю...\x1b[0m');
  bot.acceptResourcePack();
});

// --- АВТО-ЛОГИН И ДЕТЕКТ ТЕКСТА ---
bot.on('message', message => {
  const text = message.toString(); // Обычный текст для проверок
  const ansiText = message.toAnsi(); // Цветной текст для консоли Railway
  
  if (ansiText.trim().length > 0) {
    console.log(`[${bot._username}] ${ansiText}`);
  }

  // Если сервер просит логин / авторизацию
  if (text.includes('/login') || text.includes('авторизироваться') || text.includes('Введите пароль')) {
    console.log('\x1b[33m[Авто-Логин] Обнаружен запрос авторизации. Пишу пароль...\x1b[0m');
    bot.chat('/login peshkanamba0');
  }
});

bot.on('login', () => {
  if (!bot.alreadyLogged) {
    console.log(`\x1b[32m✅ ${bot._username} подключился к ReallyWorld\x1b[0m`);
    bot.alreadyLogged = true;

    // Запускаем цикличный спам попыток захода на Гриф-30 каждые 10 секунд
    if (joinTimer) clearInterval(joinTimer);
    
    console.log('\x1b[35m[Цикл Захода] Запущен интервал: попытка входа каждые 10 секунд.\x1b[0m');
    joinTimer = setInterval(() => {
      enterGrief30(bot);
    }, 10000); 
  }
});

// --- УЛУЧШЕННЫЙ МОНИТОРИНГ GUI ---
bot.on('windowOpen', (window) => {
  const guiMap = {
    "§fꈁꀀꈂꌁꈂꀁ§0ꈃꄀ": "Главное меню",
    "§fꈁꀀꈂꍄꈂꀁ§0ꈃꄠ": "Выбор Анархии",
    "§fꈁꀀꈂꍄꈂꀁ§0ꈃꄢ": "Гриферское выживание"
  };

  let titleText = "";
  try {
    const parsed = JSON.parse(window.title);
    if (parsed.text) titleText += parsed.text;
    if (parsed.extra) {
      parsed.extra.forEach(item => { if (item.text) titleText += item.text; });
    }
  } catch (e) {
    titleText = window.title || "Без названия";
  }

  const cleanTitle = titleText.replace(/§./g, '').replace(/»/g, '').trim();
  const finalTitle = guiMap[window.title] || cleanTitle || "Меню (иконка)";

  console.log(`\n\x1b[32m[GUI] СТАТУС: ОТКРЫТО ✅\x1b[0m`);
  console.log(`\x1b[33m[GUI] Название: "${finalTitle}" | ID: ${window.id}.\x1b[0m`);
});

bot.on('windowClose', (window) => {
  console.log(`\x1b[31m[GUI] Окно ID: ${window.id} было закрыто сервером.\x1b[0m`);
});

function startAntiAFK(bot, minutes) {
  if (antiAfkInterval) clearTimeout(antiAfkInterval);
  console.log(`\x1b[35m[Анти-АФК] Запущен (${minutes} мин.)\x1b[0m`);
  const performMove = () => {
    if (bot.currentWindow) return;
    bot.look(bot.entity.yaw + (Math.random() - 0.5), bot.entity.pitch);
    bot.setControlState('forward', true);
    setTimeout(() => {
      bot.setControlState('forward', false);
      setTimeout(() => {
        bot.setControlState('back', true);
        setTimeout(() => { bot.setControlState('back', false); bot.swingArm('right'); }, 500);
      }, 200);
    }, 500);
    antiAfkInterval = setTimeout(performMove, (minutes * 60 * 1000) + (Math.random() * 5000));
  };
  performMove();
}

// Логика кликов по компасу и выбора Гриф-30
async function enterGrief30(bot) {
  console.log('\x1b[36m[Вход] Достаю компас...\x1b[0m');
  const compass = bot.inventory.items().find(i => i.name.includes('compass'));
  if (!compass) return console.log('\x1b[31m⚠️ Компас не найден в инвентаре!\x1b[0m');
  
  try {
    await bot.equip(compass, 'hand');
    bot.activateItem();
    console.log('\x1b[36m[Вход] Нажал компас. Ожидаю меню анархии...\x1b[0m');

    bot.once('windowOpen', () => {
      setTimeout(() => {
        if (!bot.currentWindow) return;
        const wb = bot.currentWindow.slots.findIndex(s => s && (s.name === 'crafting_table' || s.displayName.includes('Анархия')));
        if (wb !== -1) {
          console.log(`\x1b[36m[Вход] Кликаю на категорию Анархия (слот ${wb})...\x1b[0m`);
          safeClickGUI(bot, wb);
          
          bot.once('windowOpen', () => {
            setTimeout(() => {
              if (!bot.currentWindow) return;
              // Ищем голову с количеством 30 (Гриф-30)
              const target = bot.currentWindow.slots.find(s => s && s.name.includes('head') && s.count === 30);
              if (target) { 
                console.log(`\x1b[32m[Вход] Ура, нашел Гриф-30 (слот ${target.slot}). Залетаю!\x1b[0m`);
                safeClickGUI(bot, target.slot); 
              } else {
                console.log('\x1b[31m[Вход] Иконка Гриф-30 не найдена в текущем окне.\x1b[0m');
              }
            }, 100);
          });
        }
      }, 100);
    });
  } catch (err) { console.log(`❌ Ошибка навигации: ${err.message}`); }
}

async function safeClickGUI(bot, slot) {
  if (!bot.currentWindow) return console.log('\x1b[31m⚠️ Клик отменен: GUI закрылось.\x1b[0m');
  try { 
    await bot.clickWindow(slot, 0, 0); 
    console.log(`\x1b[32m[Клик] Успешно прожат слот ${slot}\x1b[0m`);
  } catch (e) {}
}

bot.on('kicked', (reason) => { 
  console.log(`\x1b[31m⛔ Бота кикнуло: ${reason}\x1b[0m`); 
  bot.alreadyLogged = false; 
  if (joinTimer) clearInterval(joinTimer); // Сбрасываем таймер при кике
});

bot.on('error', err => console.log(`❌ Критическая ошибка: ${err.message}`));
