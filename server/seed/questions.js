const Q = (text, options, correct, topic, difficulty, explanation, extra = {}) => ({
  text,
  options,
  correct,
  topic,
  difficulty,
  explanation,
  image: null,
  table: null,
  time: null,
  ...extra,
});

const quantitative = [
  Q("A college bus covers 36 km in 45 minutes. What is its average speed in km/h?", ["42 km/h", "48 km/h", "54 km/h", "60 km/h"], 1, "quantitative", "easy", "45 minutes is 0.75 hours. 36 / 0.75 = 48 km/h."),
  Q("A hostel mess pays Rs 1,080 for 18 kg of rice. What will 7 kg cost at the same rate?", ["Rs 380", "Rs 400", "Rs 420", "Rs 450"], 2, "quantitative", "easy", "1,080 / 18 = Rs 60 per kg. 7 x 60 = Rs 420."),
  Q("35% of the 240 students in a batch chose the data science elective. How many students is that?", ["72", "84", "96", "108"], 1, "quantitative", "easy", "0.35 x 240 = 84."),
  Q("The sum of three consecutive even numbers is 78. What is the largest of them?", ["26", "28", "30", "32"], 1, "quantitative", "easy", "The numbers are 24, 26 and 28. The largest is 28."),
  Q("A phone costs Rs 15,000 after a 25% discount. What was the price before the discount?", ["Rs 18,750", "Rs 20,000", "Rs 21,000", "Rs 22,500"], 1, "quantitative", "easy", "15,000 is 75% of the original price. 15,000 / 0.75 = Rs 20,000."),
  Q("Two pipes can fill a water tank in 12 minutes and 18 minutes. How long do they take together?", ["6 minutes", "7.2 minutes", "8 minutes", "9 minutes"], 1, "quantitative", "medium", "1/12 + 1/18 = 5/36 of the tank per minute, so 36/5 = 7.2 minutes."),
  Q("A sum of money doubles itself in 8 years at simple interest. What is the rate per year?", ["8%", "10%", "12.5%", "16%"], 2, "quantitative", "medium", "Doubling means the interest equals the principal: 100% over 8 years, so 12.5% a year."),
  Q("In a class the ratio of boys to girls is 5:3, and there are 16 more boys than girls. How many students are there?", ["48", "56", "64", "72"], 2, "quantitative", "medium", "5x - 3x = 16 gives x = 8. Total is 8x = 64."),
  Q("A shopkeeper sells a bag at 20% profit. Had he sold it for Rs 90 less, he would have made 5% profit. What did the bag cost him?", ["Rs 500", "Rs 540", "Rs 600", "Rs 650"], 2, "quantitative", "medium", "The Rs 90 difference is 15% of the cost price, so the cost price is Rs 600."),
  Q("The average age of 6 friends is 22. When a seventh friend joins, the average becomes 23. How old is the seventh friend?", ["25", "27", "29", "31"], 2, "quantitative", "medium", "7 x 23 = 161 and 6 x 22 = 132. The newcomer is 161 - 132 = 29."),
  Q("Arjun invests Rs 30,000 and Bhavna invests Rs 40,000 in a venture. Arjun withdraws after 8 months. Out of a yearly profit of Rs 1,20,000, how much does Bhavna get?", ["Rs 60,000", "Rs 72,000", "Rs 80,000", "Rs 90,000"], 2, "quantitative", "hard", "Shares are 30,000 x 8 : 40,000 x 12 = 240 : 480 = 1 : 2. Bhavna gets two thirds, Rs 80,000."),
  Q("On Rs 20,000 at 10% a year for 2 years, how much more is the compound interest (yearly) than the simple interest?", ["Rs 100", "Rs 150", "Rs 200", "Rs 250"], 2, "quantitative", "hard", "Compound interest is 20,000 x 0.21 = 4,200. Simple interest is 4,000. The difference is Rs 200."),
  Q("A metro train 240 m long crosses a platform 360 m long in 30 seconds. What is its speed?", ["60 km/h", "66 km/h", "72 km/h", "80 km/h"], 2, "quantitative", "hard", "It covers 240 + 360 = 600 m in 30 s, which is 20 m/s, or 72 km/h."),
  Q("Two cards are drawn one after another from a standard deck without replacement. What is the probability that both are red?", ["1/4", "25/102", "13/51", "1/2"], 1, "quantitative", "hard", "26/52 for the first card, then 25/51 for the second. The product is 25/102."),
  Q("The HCF of two numbers is 12 and their LCM is 360. If one number is 72, what is the other?", ["48", "60", "84", "96"], 1, "quantitative", "hard", "Product of the numbers = HCF x LCM = 12 x 360 = 4,320. 4,320 / 72 = 60."),
];

const logical = [
  Q("What comes next: 5, 10, 20, 40, ?", ["60", "70", "80", "90"], 2, "logical", "easy", "Each number is double the previous one. 40 x 2 = 80."),
  Q("If TABLE is written as UBCMF in a code, how is CHAIR written?", ["DIBJS", "DIBKS", "DHBJS", "DIBJR"], 0, "logical", "easy", "Every letter moves one step forward: C>D, H>I, A>B, I>J, R>S."),
  Q("Which one does not belong: Pen, Pencil, Marker, Eraser?", ["Pen", "Pencil", "Marker", "Eraser"], 3, "logical", "easy", "The other three write; an eraser removes writing."),
  Q("Rahul walks 4 km north and then 3 km east. How far is he from where he started?", ["5 km", "6 km", "7 km", "1 km"], 0, "logical", "easy", "North and east are at right angles: the distance is the hypotenuse of a 3-4-5 triangle, 5 km."),
  Q("Mango : Fruit :: Carrot : ?", ["Root", "Vegetable", "Plant", "Orange"], 1, "logical", "easy", "A mango is a fruit; a carrot is a vegetable."),
  Q("What comes next: 2, 3, 5, 9, 17, ?", ["31", "33", "34", "35"], 1, "logical", "medium", "The gaps double: 1, 2, 4, 8, then 16. 17 + 16 = 33."),
  Q("Pointing to a woman, Neha says, \"She is the only daughter of my mother's father.\" Who is the woman to Neha?", ["Aunt", "Mother", "Sister", "Grandmother"], 1, "logical", "medium", "Her mother's father's only daughter is her mother."),
  Q("In a row of 50 students, Kabir is 17th from the left and Meera is 20th from the right. How many students sit between them?", ["11", "12", "13", "14"], 2, "logical", "medium", "50 - 17 - 20 = 13 students sit between them."),
  Q("Statements: All laptops are devices. No device is cheap. Conclusions: I. No laptop is cheap. II. Some devices are laptops. Which follow?", ["Only I", "Only II", "Both I and II", "Neither"], 2, "logical", "medium", "Laptops sit inside devices, and no device is cheap, so I follows. Since all laptops are devices, some devices are laptops, so II follows too."),
  Q("If each letter is worth its position in the alphabet, STAR = 58. What is MOON worth?", ["55", "56", "57", "58"], 2, "logical", "medium", "M = 13, O = 15, O = 15, N = 14. The total is 57."),
  Q("Five friends sit in a row facing north. Aman is immediately to the left of Bela. Chitra is at the right end. Dev sits between Aman and Esha. Who is in the middle seat?", ["Dev", "Aman", "Bela", "Esha"], 1, "logical", "hard", "Bela must be right next to Aman, so Dev is on Aman's other side: Esha, Dev, Aman, Bela, Chitra. Aman is in the middle."),
  Q("What is the angle between the hands of a clock at 9:40?", ["40 degrees", "50 degrees", "60 degrees", "70 degrees"], 1, "logical", "hard", "Hour hand: 9 x 30 + 40 x 0.5 = 290 degrees. Minute hand: 40 x 6 = 240 degrees. Difference: 50 degrees."),
  Q("15 August 2026 is a Saturday. What day of the week is 2 October 2026?", ["Thursday", "Friday", "Saturday", "Sunday"], 1, "logical", "hard", "16 days remain in August, September has 30, plus 2: 48 days. 48 leaves a remainder of 6 when divided by 7. Saturday + 6 = Friday."),
  Q("A clock shows 3:15. What time does its mirror image show?", ["8:45", "9:45", "8:15", "9:15"], 0, "logical", "hard", "Subtract from 11:60. 11:60 minus 3:15 = 8:45."),
  Q("A cube is painted red on every face and then cut into 27 equal small cubes. How many small cubes have exactly two red faces?", ["8", "12", "6", "24"], 1, "logical", "hard", "Cubes with two painted faces sit on the edges, one per edge. A cube has 12 edges."),
];

const verbal = [
  Q("Choose the word closest in meaning to DILIGENT.", ["Lazy", "Hardworking", "Careless", "Rude"], 1, "verbal", "easy", "Diligent means working carefully and steadily."),
  Q("Choose the word opposite in meaning to EXPAND.", ["Grow", "Shrink", "Spread", "Widen"], 1, "verbal", "easy", "To expand is to become larger; to shrink is the opposite."),
  Q("Fill in the blank: The results will be announced ___ Monday.", ["in", "at", "on", "by"], 2, "verbal", "easy", "Days of the week take 'on'."),
  Q("Choose the correctly spelt word.", ["Occassion", "Ocassion", "Occasion", "Ocasion"], 2, "verbal", "easy", "Occasion has a double c and a single s."),
  Q("What is the plural of 'criterion'?", ["Criterions", "Criteria", "Criterias", "Criterion"], 1, "verbal", "easy", "Criterion is singular; criteria is the plural."),
  Q("Spot the error: One of my friends (A) / have moved (B) / to Pune (C) / last month (D).", ["A", "B", "C", "D"], 1, "verbal", "medium", "'One of my friends' is singular, so it should be 'has moved'."),
  Q("One word for 'a person who is new to a job or activity':", ["Expert", "Novice", "Veteran", "Mentor"], 1, "verbal", "medium", "A novice is a beginner."),
  Q("What does the idiom 'to break the ice' mean?", ["To cause damage", "To start a conversation in an awkward situation", "To end a friendship", "To cool down"], 1, "verbal", "medium", "It means to make people feel comfortable and start talking."),
  Q("Choose the correct passive form: The manager will approve the leave.", ["The leave is approved by the manager.", "The leave will be approved by the manager.", "The leave will approve by the manager.", "The leave was approved by the manager."], 1, "verbal", "medium", "'Will approve' becomes 'will be approved'."),
  Q("Choose the grammatically correct sentence.", ["Each of the candidates have submitted their resume.", "Each of the candidates has submitted a resume.", "Each candidates has submitted a resume.", "Each of the candidate have submitted a resume."], 1, "verbal", "medium", "'Each' is singular and takes 'has'; 'candidates' stays plural after 'of'."),
  Q("Choose the word closest in meaning to EPHEMERAL.", ["Eternal", "Short-lived", "Strong", "Dull"], 1, "verbal", "hard", "Ephemeral means lasting for a very short time."),
  Q("Choose the word opposite in meaning to FRUGAL.", ["Thrifty", "Careful", "Wasteful", "Poor"], 2, "verbal", "hard", "Frugal means careful with money; wasteful is the opposite."),
  Q("Improve the sentence if needed: Hardly had I reached the station when the train left.", ["when the train had left", "than the train left", "No improvement needed", "then the train left"], 2, "verbal", "hard", "'Hardly had ... when' is the correct pair, so the sentence is already right."),
  Q("Fill both blanks: ___ the rain, the match ___ on time.", ["Although / started", "Despite / started", "Despite of / was started", "Inspite / start"], 1, "verbal", "hard", "'Despite' is followed directly by a noun, and the match 'started'."),
  Q("What does UBIQUITOUS mean?", ["Rare", "Present everywhere", "Ancient", "Hidden"], 1, "verbal", "hard", "Ubiquitous means found everywhere."),
];

const offersTable = [
  ["Branch", "Placement offers (2025)"],
  ["CSE", "120"],
  ["ECE", "80"],
  ["ME", "50"],
  ["CE", "30"],
  ["EE", "60"],
];
const budgetTable = [
  ["Expense", "Per month (Rs)"],
  ["Rent", "6,000"],
  ["Food", "4,500"],
  ["Travel", "1,500"],
  ["Internet", "500"],
  ["Other", "2,500"],
];
const mockTable = [
  ["Student", "Mock test 1", "Mock test 2"],
  ["Aarav", "64", "80"],
  ["Diya", "72", "66"],
  ["Kabir", "55", "70"],
  ["Sana", "88", "84"],
];

const dataInterpretation = [
  Q("The table shows placement offers by branch. How many offers were there in total?", ["320", "330", "340", "350"], 2, "data interpretation", "easy", "120 + 80 + 50 + 30 + 60 = 340.", { table: offersTable }),
  Q("The table shows placement offers by branch. Roughly what percentage of all offers went to CSE?", ["30%", "35%", "40%", "45%"], 1, "data interpretation", "easy", "120 out of 340 is about 35%.", { table: offersTable }),
  Q("The table shows placement offers by branch. What is the ratio of ECE offers to ME offers?", ["5:8", "8:5", "4:3", "3:4"], 1, "data interpretation", "medium", "80 : 50 simplifies to 8 : 5.", { table: offersTable }),
  Q("The table shows placement offers by branch. If EE offers rise by 25% next year and the others stay the same, what will the total be?", ["350", "355", "360", "365"], 1, "data interpretation", "medium", "EE goes from 60 to 75, so the total becomes 340 + 15 = 355.", { table: offersTable }),
  Q("The table shows placement offers by branch. Leaving out the branch with the most and the branch with the fewest offers, what is the average of the rest?", ["60", "63.3", "66.7", "70"], 1, "data interpretation", "hard", "Leave out CSE (120) and CE (30). (80 + 50 + 60) / 3 = 63.3.", { table: offersTable }),
  Q("The table shows a student's monthly expenses. What is the total for the month?", ["Rs 14,000", "Rs 14,500", "Rs 15,000", "Rs 15,500"], 2, "data interpretation", "easy", "6,000 + 4,500 + 1,500 + 500 + 2,500 = Rs 15,000.", { table: budgetTable }),
  Q("The table shows a student's monthly expenses. What share of the total goes to rent?", ["30%", "35%", "40%", "45%"], 2, "data interpretation", "easy", "6,000 out of 15,000 is 40%.", { table: budgetTable }),
  Q("The table shows a student's monthly expenses. Food and travel together are what fraction of the total?", ["1/3", "2/5", "3/5", "1/2"], 1, "data interpretation", "medium", "4,500 + 1,500 = 6,000, which is 6,000 / 15,000 = 2/5.", { table: budgetTable }),
  Q("The table shows a student's monthly expenses. In a pie chart of these expenses, what angle would Internet take?", ["6 degrees", "12 degrees", "18 degrees", "24 degrees"], 1, "data interpretation", "medium", "500 / 15,000 x 360 = 12 degrees.", { table: budgetTable }),
  Q("The table shows a student's monthly expenses. If rent rises by 10% and food by 20%, what is the new total?", ["Rs 16,200", "Rs 16,500", "Rs 16,800", "Rs 17,000"], 1, "data interpretation", "hard", "Rent adds 600 and food adds 900. 15,000 + 1,500 = Rs 16,500.", { table: budgetTable }),
  Q("The table shows mock test marks. Who scored the highest in Mock test 2?", ["Aarav", "Diya", "Kabir", "Sana"], 3, "data interpretation", "easy", "Sana scored 84, the highest in the second test.", { table: mockTable }),
  Q("The table shows mock test marks. What is Diya's average across the two tests?", ["68", "69", "70", "71"], 1, "data interpretation", "easy", "(72 + 66) / 2 = 69.", { table: mockTable }),
  Q("The table shows mock test marks. Who improved the most from the first test to the second?", ["Aarav", "Diya", "Kabir", "Sana"], 0, "data interpretation", "medium", "Aarav gained 16, Kabir 15, while Diya and Sana dropped.", { table: mockTable }),
  Q("The table shows mock test marks. What is the class average in Mock test 1?", ["68.5", "69.75", "70.25", "71"], 1, "data interpretation", "medium", "(64 + 72 + 55 + 88) / 4 = 279 / 4 = 69.75.", { table: mockTable }),
  Q("The table shows mock test marks. By what percentage did Kabir's marks rise from the first test to the second?", ["15%", "21.4%", "27.3%", "30%"], 2, "data interpretation", "hard", "(70 - 55) / 55 = 0.273, about 27.3%.", { table: mockTable }),
];

function pick(list, indexes) {
  return indexes.map((i) => list[i]);
}

function byDifficulty(list, level) {
  return list.filter((q) => q.difficulty === level);
}

export function seedSets() {
  const now = new Date().toISOString();
  const make = (id, title, description, questionTime, questions) => ({
    id,
    title,
    description,
    questionTime,
    seed: true,
    createdAt: now,
    updatedAt: now,
    questions: questions.map((q, i) => ({ ...q, id: `${id}_${i + 1}` })),
  });
  const level = (name) => [...byDifficulty(quantitative, name), ...byDifficulty(logical, name), ...byDifficulty(verbal, name), ...byDifficulty(dataInterpretation, name)];
  return [
    make("seed_lightning", "Lightning Round (demo)", "Five quick questions, 10 seconds each. Ideal for a first game.", 10, [quantitative[0], logical[0], verbal[0], dataInterpretation[0], quantitative[2]]),
    make("seed_mix", "Placement Mix 1", "24 mixed questions: two easy, two medium and two hard from each topic.", 20, [
      ...pick(quantitative, [1, 2, 5, 6, 10, 11]),
      ...pick(logical, [1, 2, 5, 6, 10, 11]),
      ...pick(verbal, [1, 2, 5, 6, 10, 11]),
      ...pick(dataInterpretation, [1, 6, 2, 3, 4, 9]),
    ]),
    make("seed_easy", "Easy warm-up", `${level("easy").length} easy questions from all four topics. Good for a first session.`, 15, level("easy")),
    make("seed_medium", "Medium round", `${level("medium").length} medium questions from all four topics. The level most placement tests sit at.`, 25, level("medium")),
    make("seed_hard", "Hard round", `${level("hard").length} hard questions from all four topics. For the final rounds of a league.`, 40, level("hard")),
    make("seed_quant", "Quantitative Aptitude Pack", "Speed, work, interest, ratios, averages and probability.", 25, quantitative),
    make("seed_logic", "Logical Reasoning Pack", "Series, coding, directions, relations, seating, clocks and calendars.", 25, logical),
    make("seed_verbal", "Verbal Ability Pack", "Vocabulary, grammar, idioms and sentence correction.", 15, verbal),
    make("seed_di", "Data Interpretation Pack", "Tables with totals, shares, ratios and growth.", 30, dataInterpretation),
  ];
}
