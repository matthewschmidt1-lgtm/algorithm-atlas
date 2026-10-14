// Worked business cases. A case takes one published lesson and runs its real method on a
// business problem with realistic figures, then says what the answer means and what the
// model leaves out. It adds no algorithm of its own: the numbers on the page come from the
// lesson's implementation, and tools/test.py checks them against an independent search.
//
// The figures are invented for the example. They are not data about any real company.

export const cases = [
  {
    id: 'budget',
    kind: 'budget',
    lesson: 'knapsack',
    title: 'Which projects should we fund this year?',
    summary: 'Eight proposals, one budget, and two tempting shortcuts that both leave money on the table.',
    scenario: 'A company has $160,000 to invest this year and eight proposals on the table. Each proposal has a cost and an estimate of what it will bring in over the year. A proposal is funded in full or not at all, and the budget cannot be exceeded.',
    // Costs are in units of $10,000 so that the lesson's method can work in whole numbers.
    unit: 10000,
    budget: 16,
    items: [
      { name: 'New booking system', cost: 4, benefit: 42 },
      { name: 'Warehouse scanners', cost: 3, benefit: 27 },
      { name: 'Website rebuild', cost: 6, benefit: 60 },
      { name: 'Staff training', cost: 5, benefit: 45 },
      { name: 'Delivery van', cost: 2, benefit: 22 },
      { name: 'Second production line', cost: 7, benefit: 66 },
      { name: 'Customer app', cost: 3, benefit: 33 },
      { name: 'Energy upgrade', cost: 4, benefit: 36 },
    ],
    assumptions: [
      { text: 'Each proposal is all or nothing. Half a website rebuild is not on offer.', then: { lesson: 'simplex', say: 'When things can be bought in any quantity, the Simplex Method fits better.' } },
      { text: 'There is one limit: money. Staff time, floor space and deadlines are ignored.', then: { lesson: 'simplex', say: 'Several limits at once, with proposals still funded whole, make this an integer program. Solvers for those are built on the Simplex Method, which on its own would hand back fractions of a proposal.' } },
      { text: 'The benefits simply add up. In reality the customer app may be worth more once the booking system exists.', then: { lesson: 'simulated-annealing', say: 'When choices affect each other, a search such as Simulated Annealing can score whole plans.' } },
      { text: 'Every benefit figure is treated as certain. They are estimates, and some are shakier than others.', then: { lesson: 'monte-carlo', say: 'Monte Carlo simulation shows how the answer moves when the estimates do.' } },
    ],
  },
];
