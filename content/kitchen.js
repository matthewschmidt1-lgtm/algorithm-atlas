// Algorithms for the kitchen: a bridge for readers who do not feel confident with numbers.
// Three things cooks already do, written out as the step lists they are, each ending at the
// lesson where a computer does the same. No formulas. Every figure here is checked by
// tools/tests.js (suite "kitchen") against the rule it illustrates.

export const kitchenIntro = {
  // on the home page, in two paragraphs
  homeLede: [
    'Think algorithms are all numbers, formulas, and computer code? Think again. You use them every time you cook. A recipe is an algorithm: a set of steps that helps you get from ingredients to something delicious.',
    'Let’s explore four everyday kitchen puzzles and discover the clever ideas behind them. No formulas, no technical jargon. Just familiar problems, simple steps, and a new way of seeing the everyday.',
  ],
  eyebrow: 'A gentle start',
  title: 'Algorithms for the kitchen',
  lede: 'An algorithm is simply a set of steps that helps you solve a problem, reliably, one step at a time. If you’ve ever followed a recipe, you’ve already used one. Here are four familiar kitchen tasks that reveal the algorithms hiding in everyday cooking. No formulas, no jargon, just simple ideas, each followed by a look at how a computer uses the same approach.',
};

export const kitchen = [
  {
    id: 'spices',
    lesson: 'binary-search',
    alsoLesson: 'linear-search',
    title: 'Finding a jar on a sorted spice rack',
    question: 'Where is the cumin?',
    gist: 'Turn the middle jar. Rule out half the rack. Repeat.',
    setup: 'Your spice rack holds sixteen jars in alphabetical order, with the labels turned to the wall. You can turn one jar at a time to read it.',
    steps: [
      'Turn the jar in the middle of the rack.',
      'If it is the spice you want, stop.',
      'If your spice comes earlier in the alphabet, forget this jar and every jar to its right. If it comes later, forget this jar and every jar to its left.',
      'Turn the middle jar of the ones that are left, and repeat.',
    ],
    point: 'That’s the whole algorithm. Each look cuts the remaining possibilities in half. With 16 jars, you’ll find the cumin in no more than 5 looks. Searching from left to right, one jar at a time, could take all 16.',
    // sixteen spices used in kitchens around the world, in alphabetical order
    jars: ['Allspice', 'Black pepper', 'Cardamom', 'Cinnamon', 'Cumin', 'Fenugreek', 'Ginger', 'Juniper', 'Mustard seed', 'Nutmeg', 'Paprika', 'Saffron', 'Star anise', 'Sumac', 'Turmeric', 'Vanilla'],
    // several paragraphs are given as a list
    limits: [
      'There’s one catch: the rack must be in order. If even one jar is out of place, you might rule out the half that contains your spice without realizing it.',
      'Computers face the same rule, even when their lists contain millions of entries. With binary search, a million entries take no more than 20 looks. The trick isn’t checking faster. It’s knowing which half you can safely ignore.',
    ],
    computer: 'Computers use exactly the same idea to search a sorted list. It’s called binary search.',
  },
  {
    id: 'dinner',
    lesson: 'critical-path',
    title: 'Getting everything to the table at once',
    question: 'When should each dish start?',
    gist: 'Start the longest chain first. Everything else has time to spare.',
    setup: 'Dinner is at 7:00. A 3-pound chicken roasting at 350°F needs about 75 minutes in the oven, until a thermometer in the thigh reads 165°F, and then 15 minutes to rest. The potatoes need 15 minutes of peeling and 20 minutes of boiling before you mash them. The green beans need 10 minutes in a pan.',
    serveAt: [19, 0],
    dishes: [
      { name: 'Roast chicken', tasks: [{ name: 'in the oven', minutes: 75 }, { name: 'resting', minutes: 15 }] },
      { name: 'Mashed potatoes', tasks: [{ name: 'peeling', minutes: 15 }, { name: 'boiling', minutes: 20 }] },
      { name: 'Green beans', tasks: [{ name: 'in the pan', minutes: 10 }] },
    ],
    steps: [
      'For each dish, add up the steps that have to happen one after another.',
      'Find the longest of these chains. Here it is the chicken: 75 minutes and then 15, which is 90 minutes.',
      'Count back from dinner time. The chicken has to go in at 5:30. No dish can make dinner earlier than its longest chain allows.',
      'Every other dish can start later. The potatoes need 35 minutes, so they can start any time up to 6:25. The beans can wait until 6:50.',
    ],
    point: 'The chain of tasks with no time to spare is called the critical path. Delay any task on it, and dinner is late. Delay a task elsewhere, and you can use up some of its spare time without affecting the finish, at least until that spare time runs out.',
    limits: [
      'The method, on its own, assumes you have all the people and equipment you need, whenever you need them. But a real cook can’t peel potatoes and baste a roast at the same time. And two dishes might need the oven at different temperatures.',
      'Projects face the same problem: people, machines and other resources are limited. Working out the critical path is one challenge; figuring out how to share those resources is another.',
    ],
    checked: 'The times come from real kitchens. The USDA’s roasting chart gives 1¼ to 1½ hours at 350°F for a 3- to 4-pound chicken, and America’s Test Kitchen rests its roast chicken for 15 minutes. Recipes give 15 to 30 minutes to boil potatoes for mashing, and 7 to 10 minutes to sauté green beans.',
    sources: ['usda-roasting', 'atk-chicken', 'tt-potatoes', 'rfd-beans'],
    computer: 'Project managers use the same idea to plan everything from building projects to product launches and live events. The technique is called the critical path method, and it helps them see which tasks must stay on schedule to keep the whole project on track.',
  },
  {
    id: 'dressing',
    lesson: 'gradient-descent',
    title: 'Tasting your way to the right dressing',
    question: 'How much lemon?',
    gist: 'Taste, adjust a little, taste again.',
    setup: 'You are making a salad dressing from oil and lemon juice. The classic starting point is three parts oil to one part lemon juice, but lemons differ and so do tastes. You want it to taste right.',
    checked: 'Three parts oil to one part acid, whether vinegar or citrus juice, is the classic starting ratio for a vinaigrette. The tasting is what turns a starting point into your dressing.',
    sources: ['chowhound-vinaigrette'],
    steps: [
      'Taste it.',
      'If it is too sharp, add a little oil. If it is too flat, add a little lemon.',
      'The further off it tastes, the bigger the splash. The closer it gets, the smaller.',
      'Taste again, and repeat until you are happy with it.',
    ],
    tastes: [
      { taste: 'Far too sharp', change: 'A big splash of oil' },
      { taste: 'Still a little sharp', change: 'A small splash of oil' },
      { taste: 'Now a touch flat', change: 'A few drops of lemon' },
      { taste: 'Right', change: 'Stop' },
    ],
    point: 'Look at the third taste. That little splash of oil went too far, so the next adjustment went back the other way, and was smaller this time. Overshooting, then correcting, is part of the process. It’s how you find your way toward the right balance.',
    limits: 'A computer measures error with a number, not a taste, and it may adjust millions of settings at once rather than just a couple of ingredients. But there’s another catch: like a cook adjusting a dressing, the model works its way forward from where it starts. It might settle on a good solution without ever finding a better one that lies somewhere else. Sometimes, the starting point makes all the difference.',
    computer: 'This is how a machine learning model learns, too. It makes a prediction, measures how far off it was, adjusts its settings to reduce the error, and tries again. Each small correction brings it closer to a better result. The technique is called gradient descent.',
  },
  {
    id: 'pizza',
    lesson: 'euler-method',
    title: 'Heating a wood-fired oven, in summer and in snow',
    question: 'When should you light the fire?',
    gist: 'Predict the heat ten minutes at a time. Snow changes the answer.',
    setup: 'You have made pizza dough by hand, and it will have finished rising at 7:00 this evening. The pizza oven is outside and burns wood, and its floor needs to reach about 800°F before the first pizza goes in. On a summer evening the air is 75°F. On a winter evening there is snow on the ground, a cold wind, and the air is 30°F.',
    // the oven, ten minutes at a time: the fire adds a fixed amount, and the oven loses a share
    // of the gap between its own heat and the outside air. The numbers are invented to show the idea.
    oven: {
      stepMinutes: 10, fire: 135, target: 800, unit: '°F', readyAt: [19, 0], minutes: 180,
      seasons: [
        { id: 'summer', name: 'Summer evening', air: 75, share: 1 / 7 },
        { id: 'winter', name: 'Winter evening, with snow', air: 30, share: 1 / 6 },
      ],
    },
    steps: [
      'Start with the oven at the temperature of the air outside.',
      'For the next ten minutes, the fire adds about 135 degrees.',
      'In the same ten minutes, the oven loses part of the gap between its own heat and the air outside: about a seventh on a summer evening, and about a sixth in snow and a cold wind. The hotter the oven gets, the bigger the gap, and the more heat it loses.',
      'Write down the new temperature and repeat until the oven reaches 800°F. Then count back from 7:00.',
    ],
    point: 'In summer the oven reaches 800°F after 100 minutes, so you light the fire by 5:20. In winter it takes 170 minutes, so you light it by 4:10. And with this fire, the winter oven can never pass 840°F: at that point it loses heat as fast as the fire adds it. To go hotter in the snow, you need a bigger fire or less heat escaping.',
    limits: [
      'The fire and the heat lost each ten minutes are chosen to show the idea, though the times they give fall where real ovens do. A real oven is not one temperature: the floor heats more slowly than the dome, and a fire does not add the same heat every ten minutes.',
      'Each step also uses the temperature at the start of its ten minutes, even though the oven keeps warming during them. That is why the method works best with small steps. A computer might take steps of a second, or less.',
    ],
    checked: 'The targets come from real pizza ovens. The Neapolitan pizza association’s rules bake a pizza for 60 to 90 seconds at about 905°F, and a 2024 study of a working wood-fired oven measured its floor at about 820°F and its dome at 900°F or more. Owners of home wood ovens report heating times from under an hour to about three, depending on the oven, and the oven maker Forno Bravo notes that a cold dome and wind across the oven’s mouth draw more heat from the fire.',
    sources: ['wiki-neapolitan', 'falciano-2024', 'fb-winter', 'fb-forum'],
    computer: 'Computers predict how things change over time in the same way: the weather, the path of a spacecraft, how a building warms up. They start from what they know now, take a small step forward in time, and repeat. The simplest version is called Euler’s method, and the smaller the steps, the closer the prediction comes to what really happens.',
  },
];

// Where the real numbers come from. Each recipe lists the ones it draws on. Kept here as the
// record behind the "Checked against real kitchens" lines; the page names them in the prose only.
export const kitchenSources = {
  'usda-roasting': { title: 'Meat and Poultry Roasting Charts', by: 'FoodSafety.gov (US Department of Agriculture)', url: 'https://www.foodsafety.gov/food-safety-charts/meat-poultry-charts' },
  'atk-chicken': { title: 'Seven Steps to Perfect Roast Chicken', by: 'America’s Test Kitchen', url: 'https://www.americastestkitchen.com/how_tos/6026-seven-steps-to-perfect-roast-chicken' },
  'tt-potatoes': { title: 'How Long to Boil Potatoes for Classic, Fluffy Mashed Potatoes', by: 'Tasting Table', url: 'https://www.tastingtable.com/2215817/how-long-to-boil-potatoes-for-mashed-potatoes/' },
  'rfd-beans': { title: 'Sautéed Green Beans', by: 'The Real Food Dietitians', url: 'https://therealfooddietitians.com/sauteed-green-beans/' },
  'chowhound-vinaigrette': { title: 'Use the Classic 3-to-1 Method to Create Perfect Salad Dressing Every Time', by: 'Chowhound', url: 'https://www.chowhound.com/2229425/classic-three-to-one-method-for-perfect-salad-dressing/' },
  'wiki-neapolitan': { title: 'Neapolitan pizza (on the association’s production rules)', by: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Neapolitan_pizza' },
  'falciano-2024': { title: 'Unlocking the secrets of Neapolitan pizza: A concise review of wood-fired, electric, and gas pizza ovens', by: 'Falciano, Masi and Moresi, Journal of Food Science 89 (2024)', url: 'https://doi.org/10.1111/1750-3841.17417' },
  'fb-winter': { title: 'Winter Wood-Fired Cooking Tips', by: 'Forno Bravo', url: 'https://www.fornobravo.com/blog/winter-wood-fired-cooking-tips/' },
  'fb-forum': { title: 'What is the average time you heat up ovens to cook pizza?', by: 'Forno Bravo community forum', url: 'https://community.fornobravo.com/forum/good-background-information/newbie-forum/442738-what-is-average-time-you-guys-heat-up-ovens-to-cook-pizza' },
};

export const kitchenEnd = {
  title: 'What the four have in common',
  text: [
    'Each one is a clear set of steps that anyone can follow, that comes to an end, and that produces a reliable result. That’s all an algorithm is.',
    'Every lesson in this atlas explores one of these ideas, written precisely enough for a computer to follow. You can run it yourself and watch each step unfold, turning an abstract idea into something you can see and understand.',
  ],
};
