module.exports = {
  run: (bot, args) => {
    const mins = parseFloat(args) || 5;
    if (bot.afkTimer) clearTimeout(bot.afkTimer);
    
    console.log(`\x1b[35m[Patch] Система "Умный АФК + Авто-Вход x30" активирована.\x1b[0m`);

    const afkHandler = (message) => {
      const text = message.toString();
      
      // Ищем надпись AFK в чате
      if (text.includes('AFK')) {
        console.log('\x1b[31m[Авто-Вход] Обнаружен статус AFK! Эмулирую ввод !join 30...\x1b[0m');
        
        setTimeout(() => {
          // Отправляем команду !join 30 прямо в поток ввода процесса
          // Это заставит твой основной скрипт сработать так, будто ты ввел это руками
          process.stdin.emit('data', Buffer.from('!join 30\n'));
        }, 1500);
      }
    };

    // Обновляем слушатель
    bot.removeListener('message', afkHandler);
    bot.on('message', afkHandler);

    // Логика умного Анти-АФК
    const performSmartMove = () => {
      if (bot.currentWindow) {
        bot.afkTimer = setTimeout(performSmartMove, 5000);
        return;
      }

      const actions = [
        () => {
          console.log("[Анти-АФК] Прогулка");
          bot.setControlState('forward', true);
          setTimeout(() => {
            bot.setControlState('forward', false);
            setTimeout(() => {
              bot.setControlState('back', true);
              setTimeout(() => { bot.setControlState('back', false); bot.swingArm('right'); }, 400);
            }, 200);
          }, 500);
        },
        () => {
          console.log("[Анти-АФК] Осмотр");
          const yaw = bot.entity.yaw + (Math.random() - 0.5) * 2;
          bot.look(yaw, bot.entity.pitch);
          setTimeout(() => bot.swingArm('right'), 300);
        }
      ];

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      randomAction();

      const nextDelay = (mins * 60 * 1000) + (Math.random() * 20000);
      bot.afkTimer = setTimeout(performSmartMove, nextDelay);
    };

    performSmartMove();
  }
};