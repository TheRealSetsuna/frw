const mineflayer = require('mineflayer');
const readline = require('readline');
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const loadedModules = {};

rl.question('Введите ник бота: ', (username) => {
  const bot = mineflayer.createBot({
    host: 'mc.reallyworld.me',
    username: username,
    version: '1.20.1'
  });

  bot._username = username;
  bot.alreadyLogged = false;
  let antiAfkInterval = null;

  bot.on('resourcePack', () => {
    console.log('\x1b[35m[Система] Сервер предложил ресурспак. Принимаю...\x1b[0m');
    bot.acceptResourcePack();
  });

  bot.on('message', message => {
    const text = message.toAnsi();
    if (text.trim().length > 0) console.log(`[${bot._username}] ${text}`);
  });

  bot.on('login', () => {
    if (!bot.alreadyLogged) {
      console.log(`\x1b[32m✅ ${bot._username} подключился к ReallyWorld\x1b[0m`);
      bot.alreadyLogged = true;
    }
  });

  // --- УЛУЧШЕННЫЙ МОНИТОРИНГ GUI (Логика парсинга из c.js) ---
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
    console.log(`\x1b[33m[GUI] Название: "${finalTitle}" | ID: ${window.id}. Пропиши !gui чтобы увидеть слоты.\x1b[0m`);
  });

  bot.on('windowClose', (window) => {
    console.log(`\x1b[31m[GUI] Окно ID: ${window.id} было закрыто сервером.\x1b[0m`);
  });

  // --- ОБРАБОТКА КОМАНД ---
  rl.on('line', async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const args = trimmed.split(' ');
    const command = args[0];

    if (command.startsWith('!')) {
      if (command === '!join') {
        enterGrief30(bot);
      } 
      else if (command === '!antiafk') {
        const mins = parseFloat(args[1]);
        if (!isNaN(mins) && mins > 0) startAntiAFK(bot, mins);
        else console.log('\x1b[31m⚠️ Используй: !antiafk [минуты]\x1b[0m');
      }
      else if (command === '!import') {
        const fileName = args[1];
        if (!fileName) return console.log('\x1b[31m⚠️ Укажите файл: !import test.js\x1b[0m');
        const filePath = path.resolve(__dirname, fileName);
        try {
          if (require.cache[filePath]) delete require.cache[filePath];
          const imported = require(filePath);
          const moduleName = fileName.replace('.js', '');
          loadedModules[moduleName] = imported;
          if (typeof imported === 'function') imported(bot);
          else if (imported.init) imported.init(bot);
          console.log(`\x1b[32m✅ Модуль ${fileName} успешно подгружен!\x1b[0m`);
        } catch (e) { console.log(`\x1b[31m❌ Ошибка: ${e.message}\x1b[0m`); }
      }
      else if (command === '!gui') {
        if (!bot.currentWindow) {
          console.log('\x1b[31m⚠️ Меню не открыто.\x1b[0m');
        } else {
          console.log('\x1b[36m--- Содержимое текущего GUI ---\x1b[0m');
          let hasItems = false;
          bot.currentWindow.slots.forEach((s, i) => {
            if (s && i < bot.currentWindow.inventoryStart) {
              console.log(` Слот [${i}]: ${s.displayName} x${s.count} (${s.name})`);
              hasItems = true;
            }
          });
          if (!hasItems) console.log(' Меню пустое или предметы еще не загрузились.');
          console.log('\x1b[36m--------------------------------\x1b[0m');
        }
      }
      else if (command === '!usegui') {
        const slotId = parseInt(args[1]);
        if (isNaN(slotId)) return console.log('\x1b[31m⚠️ Укажите слот: !usegui [номер]\x1b[0m');
        safeClickGUI(bot, slotId);
      }
      else if (command === '!usehotbar') {
        const slot = parseInt(args[1]);
        if (isNaN(slot) || slot < 0 || slot > 8) return console.log('\x1b[31m⚠️ Слот 0-8!\x1b[0m');
        bot.setQuickBarSlot(slot);
        setTimeout(() => { bot.activateItem(); console.log(`\x1b[32m[Хотбар] Использовал слот ${slot}\x1b[0m`); }, 100);
      }
      else {
        const modKey = command.replace('!', '');
        if (loadedModules[modKey] && typeof loadedModules[modKey].run === 'function') {
          loadedModules[modKey].run(bot, args.slice(1).join(' '));
        } else console.log('\x1b[31m⚠️ Неизвестная команда.\x1b[0m');
      }
    } 
    else if (trimmed.startsWith('/')) { bot.chat(trimmed); } 
    else { console.log('\x1b[31m[Защита] Только команды / или !\x1b[0m'); }
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

  async function enterGrief30(bot) {
    console.log('\x1b[36m[Шаг 1] Достаю компас...\x1b[0m');
    const compass = bot.inventory.items().find(i => i.name.includes('compass'));
    if (!compass) return console.log('\x1b[31m⚠️ Компас не найден!\x1b[0m');
    
    try {
      await bot.equip(compass, 'hand');
      bot.activateItem();
      console.log('\x1b[36m[Шаг 2] Компас нажат. Жду меню...\x1b[0m');

      bot.once('windowOpen', () => {
        setTimeout(() => {
          if (!bot.currentWindow) return;
          const wb = bot.currentWindow.slots.findIndex(s => s && (s.name === 'crafting_table' || s.displayName.includes('Анархия')));
          if (wb !== -1) {
            console.log(`\x1b[36m[Шаг 3] Жму на Анархию (слот ${wb})...\x1b[0m`);
            safeClickGUI(bot, wb);
            bot.once('windowOpen', () => {
              setTimeout(() => {
                if (!bot.currentWindow) return;
                const target = bot.currentWindow.slots.find(s => s && s.name.includes('head') && s.count === 30);
                if (target) { 
                    console.log(`\x1b[32m[Шаг 4] Нашел Гриф-30. Захожу!\x1b[0m`);
                    safeClickGUI(bot, target.slot); 
                }
              }, 50);
            });
          }
        }, 50);
      });
    } catch (err) { console.log(`❌ ${err.message}`); }
  }

  async function safeClickGUI(bot, slot) {
    if (!bot.currentWindow) return console.log('\x1b[31m⚠️ Ошибка: GUI уже закрыто.\x1b[0m');
    try { 
        await bot.clickWindow(slot, 0, 0); 
        console.log(`\x1b[32m[Клик] Слот ${slot}\x1b[0m`);
    } catch (e) {}
  }

  bot.on('kicked', (reason) => { console.log(`\x1b[31m⛔ Кик: ${reason}\x1b[0m`); bot.alreadyLogged = false; });
  bot.on('error', err => console.log(`❌ Ошибка: ${err.message}`));
});