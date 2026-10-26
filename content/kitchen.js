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
    jars: ['Allspice', 'Basil', 'Cardamom', 'Cinnamon', 'Cloves', 'Cumin', 'Dill', 'Fennel', 'Ginger', 'Mint', 'Nutmeg', 'Oregano', 'Paprika', 'Rosemary', 'Saffron', 'Thyme'],
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
    setup: 'Dinner is at 7:00. The roast chicken needs 75 minutes in the oven and then 15 minutes to rest. The potatoes need 15 minutes of peeling and then 45 minutes in the oven. The green beans need 10 minutes in a pan.',
    serveAt: [19, 0],
    dishes: [
      { name: 'Roast chicken', tasks: [{ name: 'in the oven', minutes: 75 }, { name: 'resting', minutes: 15 }] },
      { name: 'Roast potatoes', tasks: [{ name: 'peeling', minutes: 15 }, { name: 'in the oven', minutes: 45 }] },
      { name: 'Green beans', tasks: [{ name: 'in the pan', minutes: 10 }] },
    ],
    steps: [
      'For each dish, add up the steps that have to happen one after another.',
      'Find the longest of these chains. Here it is the chicken: 75 minutes and then 15, which is 90 minutes.',
      'Count back from dinner time. The chicken has to go in at 5:30. No dish can make dinner earlier than its longest chain allows.',
      'Every other dish can start later. The potatoes need 60 minutes, so they can start any time up to 6:00. The beans can wait until 6:50.',
    ],
    point: 'The chain of tasks with no time to spare is called the critical path. Delay any task on it, and dinner is late. Delay a task elsewhere, and you can use up some of its spare time without affecting the finish, at least until that spare time runs out.',
    limits: [
      'The method, on its own, assumes you have all the people and equipment you need, whenever you need them. But a real cook can’t peel potatoes and baste a roast at the same time. And two dishes might need the oven at different temperatures.',
      'Projects face the same problem: people, machines and other resources are limited. Working out the critical path is one challenge; figuring out how to share those resources is another.',
    ],
    computer: 'Project managers use the same idea to plan everything from building projects to product launches and live events. The technique is called the critical path method, and it helps them see which tasks must stay on schedule to keep the whole project on track.',
  },
  {
    id: 'dressing',
    lesson: 'gradient-descent',
    title: 'Tasting your way to the right dressing',
    question: 'How much lemon?',
    gist: 'Taste, adjust a little, taste again.',
    setup: 'You are making a salad dressing from oil and lemon juice. No recipe gives the exact amounts for your lemons and your taste. You want it to taste right.',
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
    setup: 'You have made pizza dough by hand, and it will have finished rising at 7:00 this evening. The pizza oven is outside and burns wood, and it needs to reach 750°F before the first pizza goes in. On a summer evening the air is 75°F. On a winter evening there is snow on the ground, a cold wind, and the air is 30°F.',
    // the oven, ten minutes at a time: the fire adds a fixed amount, and the oven loses a share
    // of the gap between its own heat and the outside air. The numbers are invented to show the idea.
    oven: {
      stepMinutes: 10, fire: 115, target: 750, unit: '°F', readyAt: [19, 0], minutes: 180,
      seasons: [
        { id: 'summer', name: 'Summer evening', air: 75, share: 1 / 10 },
        { id: 'winter', name: 'Winter evening, with snow', air: 30, share: 1 / 7 },
      ],
    },
    steps: [
      'Start with the oven at the temperature of the air outside.',
      'For the next ten minutes, the fire adds about 115 degrees.',
      'In the same ten minutes, the oven loses part of the gap between its own heat and the air outside: about a tenth on a summer evening, and about a seventh in snow and a cold wind. The hotter the oven gets, the bigger the gap, and the more heat it loses.',
      'Write down the new temperature and repeat until the oven reaches 750°F. Then count back from 7:00.',
    ],
    point: 'In summer the oven reaches 750°F after 90 minutes, so you light the fire by 5:30. In winter it takes 150 minutes, so you light it by 4:30. And with this fire, the winter oven can never pass 835°F: at that point it loses heat as fast as the fire adds it. To go hotter in the snow, you need a bigger fire or less heat escaping.',
    limits: [
      'The numbers here are invented to show the idea. A real oven is not one temperature: the floor heats more slowly than the dome, and a fire does not add the same heat every ten minutes.',
      'Each step also uses the temperature at the start of its ten minutes, even though the oven keeps warming during them. That is why the method works best with small steps. A computer might take steps of a second, or less.',
    ],
    computer: 'Computers predict how things change over time in the same way: the weather, the path of a spacecraft, how a building warms up. They start from what they know now, take a small step forward in time, and repeat. The simplest version is called Euler’s method, and the smaller the steps, the closer the prediction comes to what really happens.',
  },
];

export const kitchenEnd = {
  title: 'What the four have in common',
  text: [
    'Each one is a clear set of steps that anyone can follow, that comes to an end, and that produces a reliable result. That’s all an algorithm is.',
    'Every lesson in this atlas explores one of these ideas, written precisely enough for a computer to follow. You can run it yourself and watch each step unfold, turning an abstract idea into something you can see and understand.',
  ],
};
