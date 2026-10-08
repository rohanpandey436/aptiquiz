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
  Q("A train 150 m long passes a pole in 15 seconds. What is its speed in km/h?", ["36 km/h", "40 km/h", "54 km/h", "60 km/h"], 0, "quantitative", "easy", "150 m in 15 s is 10 m/s. Multiply by 18/5 to get 36 km/h."),
  Q("12 workers finish a job in 20 days. How many days will 15 workers take at the same rate?", ["14 days", "16 days", "18 days", "25 days"], 1, "quantitative", "easy", "Total work is 12 x 20 = 240 worker-days. 240 / 15 = 16 days."),
  Q("What is the simple interest on Rs 8,000 at 5% per annum for 3 years?", ["Rs 1,000", "Rs 1,200", "Rs 1,500", "Rs 2,400"], 1, "quantitative", "easy", "SI = P x R x T / 100 = 8000 x 5 x 3 / 100 = Rs 1,200."),
  Q("The average of 5 numbers is 27. When one number is removed, the average of the remaining numbers is 25. Which number was removed?", ["32", "35", "37", "40"], 1, "quantitative", "medium", "Sum of five numbers is 135. Sum of the remaining four is 100. The removed number is 35."),
  Q("A shopkeeper marks up an item by 25% and then offers a 20% discount on the marked price. What is the net result?", ["5% profit", "5% loss", "No profit, no loss", "2% loss"], 2, "quantitative", "medium", "1.25 x 0.80 = 1.00, so the selling price equals the cost price."),
  Q("The ages of A and B are in the ratio 3:4 and their sum is 56. What will the ratio be after 8 years?", ["4:5", "5:6", "3:4", "7:8"], 0, "quantitative", "medium", "A = 24, B = 32. After 8 years: 32:40 = 4:5."),
  Q("What is the square root of 0.0049?", ["0.7", "0.07", "0.007", "0.49"], 1, "quantitative", "easy", "0.0049 = 49 / 10000, so the root is 7 / 100 = 0.07."),
  Q("A can do a piece of work in 10 days and B in 15 days. How long will they take together?", ["5 days", "6 days", "8 days", "12 days"], 1, "quantitative", "easy", "1/10 + 1/15 = 1/6, so together they take 6 days."),
  Q("Two dice are thrown. What is the probability that the sum is 9?", ["1/6", "1/9", "1/12", "1/8"], 1, "quantitative", "medium", "Favourable pairs: (3,6), (4,5), (5,4), (6,3). That is 4 out of 36 = 1/9."),
  Q("What is the compound interest on Rs 10,000 at 10% per annum for 2 years, compounded yearly?", ["Rs 2,000", "Rs 2,100", "Rs 2,200", "Rs 2,500"], 1, "quantitative", "medium", "Amount = 10000 x 1.1 x 1.1 = 12,100. Interest = Rs 2,100."),
  Q("What is the LCM of 12, 18 and 24?", ["36", "48", "72", "144"], 2, "quantitative", "easy", "12 = 2^2 x 3, 18 = 2 x 3^2, 24 = 2^3 x 3. LCM = 2^3 x 3^2 = 72."),
  Q("A boat travels at 20 km/h in still water and the stream flows at 4 km/h. How long does it take to go 48 km downstream?", ["2 hours", "2.5 hours", "3 hours", "4 hours"], 0, "quantitative", "easy", "Downstream speed is 24 km/h. 48 / 24 = 2 hours."),
  Q("40% of a number is 120. What is 25% of the same number?", ["60", "75", "80", "90"], 1, "quantitative", "easy", "The number is 300. 25% of 300 = 75."),
  Q("A price is increased by 10% and then decreased by 10%. What is the net change?", ["No change", "1% decrease", "1% increase", "2% decrease"], 1, "quantitative", "medium", "1.10 x 0.90 = 0.99, a net decrease of 1%."),
];

const logical = [
  Q("Find the next number: 2, 6, 12, 20, 30, ?", ["40", "42", "44", "48"], 1, "logical", "easy", "Differences grow by 2 each time: 4, 6, 8, 10, 12. 30 + 12 = 42."),
  Q("If CAT is written as 3120 (C=3, A=1, T=20), how is DOG written?", ["4157", "4715", "4175", "4517"], 0, "logical", "easy", "D=4, O=15, G=7, giving 4157."),
  Q("Which one does not belong: Apple, Banana, Carrot, Mango?", ["Apple", "Banana", "Carrot", "Mango"], 2, "logical", "easy", "Carrot is a vegetable; the others are fruits."),
  Q("Pointing to a photograph, a man says, \"She is the daughter of my grandfather's only son.\" Who is she to the man?", ["Mother", "Sister", "Cousin", "Aunt"], 1, "logical", "medium", "Grandfather's only son is the man's father. His father's daughter is his sister."),
  Q("A is to the north of B. C is to the east of B. In which direction is A with respect to C?", ["North-east", "North-west", "South-west", "South-east"], 1, "logical", "medium", "Place B at the origin, A above it and C to its right. A is up and to the left of C, which is north-west."),
  Q("Find the next letter: A, C, F, J, O, ?", ["T", "U", "V", "W"], 1, "logical", "medium", "Gaps grow by one: +2, +3, +4, +5, +6. O + 6 = U."),
  Q("Statements: All pens are tools. Some tools are heavy. Conclusions: I. Some pens are heavy. II. All tools are pens. Which follows?", ["Only I", "Only II", "Both I and II", "Neither I nor II"], 3, "logical", "hard", "The heavy tools may not be pens, so I does not follow. II reverses the first statement, so it does not follow either."),
  Q("A clock shows 4:20. What time does its mirror image show?", ["7:40", "8:40", "7:20", "8:20"], 0, "logical", "medium", "Subtract from 11:60. 11:60 minus 4:20 = 7:40."),
  Q("In a certain code, MANGO is written as NBOHP. How is APPLE written in that code?", ["BQQMF", "BQQLF", "BPQMF", "BQRMF"], 0, "logical", "easy", "Each letter moves one step forward: A>B, P>Q, P>Q, L>M, E>F."),
  Q("Find the next number: 3, 7, 15, 31, 63, ?", ["125", "127", "129", "131"], 1, "logical", "easy", "Each term is double the previous one plus 1. 63 x 2 + 1 = 127."),
  Q("In a row of 40 students, Ravi is 12th from the left. What is his position from the right?", ["27th", "28th", "29th", "30th"], 2, "logical", "easy", "Position from the right = 40 - 12 + 1 = 29."),
  Q("A's mother is the sister of B's father. How is A related to B?", ["Brother", "Nephew", "Cousin", "Uncle"], 2, "logical", "medium", "B's father is A's maternal uncle, so A and B are cousins."),
  Q("What is the angle between the hands of a clock at 3:30?", ["45 degrees", "60 degrees", "75 degrees", "90 degrees"], 2, "logical", "medium", "Hour hand: 3 x 30 + 15 = 105 degrees. Minute hand: 180 degrees. Difference: 75 degrees."),
  Q("1 January 2025 is a Wednesday. What day of the week is 1 March 2025?", ["Friday", "Saturday", "Sunday", "Monday"], 1, "logical", "hard", "January has 31 days and February 2025 has 28, so 59 days pass. 59 mod 7 = 3. Wednesday + 3 = Saturday."),
];

const verbal = [
  Q("Choose the word closest in meaning to CANDID.", ["Secretive", "Frank", "Rude", "Polite"], 1, "verbal", "easy", "Candid means honest and direct, which is frank."),
  Q("Choose the word opposite in meaning to SCARCE.", ["Rare", "Abundant", "Little", "Few"], 1, "verbal", "easy", "Scarce means in short supply; abundant is its opposite."),
  Q("Fill in the blank: She is very good ___ mathematics.", ["in", "at", "on", "with"], 1, "verbal", "easy", "The idiomatic preposition is 'good at'."),
  Q("Spot the error: Each of the students (A) / have submitted (B) / their assignment (C) / on time (D).", ["A", "B", "C", "D"], 1, "verbal", "medium", "'Each' is singular, so it should be 'has submitted'."),
  Q("One word for 'a person who speaks many languages':", ["Linguist", "Polyglot", "Bilingual", "Orator"], 1, "verbal", "medium", "A polyglot speaks several languages. A linguist studies language."),
  Q("What does the idiom 'to hit the nail on the head' mean?", ["To hurt someone", "To say exactly the right thing", "To finish a job", "To make a mistake"], 1, "verbal", "easy", "It means to describe a situation or problem exactly."),
  Q("Choose the correctly spelt word.", ["Recieve", "Receive", "Receeve", "Reciev"], 1, "verbal", "easy", "The rule is 'i before e except after c': receive."),
  Q("Doctor : Hospital :: Teacher : ?", ["Book", "School", "Student", "Class"], 1, "verbal", "easy", "A doctor works in a hospital; a teacher works in a school."),
  Q("Choose the correct passive form: The committee approved the proposal.", ["The proposal is approved by the committee.", "The proposal was approved by the committee.", "The proposal has approved by the committee.", "The proposal approved by the committee."], 1, "verbal", "medium", "Past simple active becomes 'was/were + past participle'."),
  Q("Choose the word opposite in meaning to VERBOSE.", ["Wordy", "Concise", "Loud", "Lengthy"], 1, "verbal", "medium", "Verbose means using too many words; concise is the opposite."),
  Q("Choose the grammatically correct sentence.", ["Neither of the answers are correct.", "Neither of the answers is correct.", "Neither of the answer are correct.", "Neither answers is correct."], 1, "verbal", "medium", "'Neither of' takes a singular verb: 'is'."),
  Q("Choose the word closest in meaning to METICULOUS.", ["Careless", "Careful", "Quick", "Lazy"], 1, "verbal", "easy", "Meticulous means showing great attention to detail."),
  Q("Fill in the blank: He has been working here ___ 2019.", ["for", "since", "from", "by"], 1, "verbal", "easy", "'Since' is used with a point in time; 'for' with a duration."),
  Q("Which word does not belong: Happy, Joyful, Cheerful, Gloomy?", ["Happy", "Joyful", "Cheerful", "Gloomy"], 3, "verbal", "easy", "Gloomy describes sadness; the other three describe happiness."),
];

const salesTable = [
  ["Quarter", "Units sold"],
  ["Q1", "120"],
  ["Q2", "150"],
  ["Q3", "90"],
  ["Q4", "180"],
];
const marksTable = [
  ["Student", "Test 1", "Test 2"],
  ["A", "60", "80"],
  ["B", "70", "50"],
  ["C", "90", "85"],
  ["D", "40", "70"],
  ["E", "75", "75"],
];
const budgetTable = [
  ["Item", "Share of income"],
  ["Rent", "30%"],
  ["Food", "25%"],
  ["Transport", "10%"],
  ["Savings", "20%"],
  ["Other", "15%"],
];
const plantTable = [
  ["Year", "Plant P (000s)", "Plant Q (000s)"],
  ["2022", "40", "50"],
  ["2023", "55", "45"],
  ["2024", "75", "60"],
];

const dataInterpretation = [
  Q("The table shows quarterly sales of a company. What were the total sales for the year?", ["520", "540", "560", "600"], 1, "data interpretation", "easy", "120 + 150 + 90 + 180 = 540.", { table: salesTable }),
  Q("The table shows quarterly sales. By what percentage did sales rise from Q3 to Q4?", ["50%", "90%", "100%", "200%"], 2, "data interpretation", "medium", "(180 - 90) / 90 = 1, which is a 100% rise.", { table: salesTable }),
  Q("The table shows quarterly sales. Q2 sales are approximately what percentage of the annual total?", ["25%", "27.8%", "30%", "33.3%"], 1, "data interpretation", "medium", "150 / 540 = 0.278, about 27.8%.", { table: salesTable }),
  Q("The table shows marks of five students in two tests. Who improved the most from Test 1 to Test 2?", ["A", "C", "D", "E"], 2, "data interpretation", "easy", "A improved by 20, D by 30, C fell by 5, E stayed the same.", { table: marksTable }),
  Q("The table shows marks of five students. What is the average mark in Test 1?", ["65", "67", "68", "70"], 1, "data interpretation", "easy", "(60 + 70 + 90 + 40 + 75) / 5 = 335 / 5 = 67.", { table: marksTable }),
  Q("The table shows marks of five students. How many students scored above 70 in Test 2?", ["2", "3", "4", "5"], 1, "data interpretation", "medium", "A (80), C (85) and E (75) are above 70. D scored exactly 70.", { table: marksTable }),
  Q("A family earns Rs 50,000 a month and spends as shown. How much goes to food?", ["Rs 10,000", "Rs 12,500", "Rs 15,000", "Rs 7,500"], 1, "data interpretation", "easy", "25% of 50,000 = Rs 12,500.", { table: budgetTable }),
  Q("A family spends as shown in the table. What is the ratio of rent to savings?", ["2:3", "3:2", "3:5", "5:3"], 1, "data interpretation", "easy", "30% : 20% simplifies to 3:2.", { table: budgetTable }),
  Q("A family earns Rs 50,000 and spends as shown. If income rises to Rs 60,000 with the same shares, how much more goes to savings?", ["Rs 1,000", "Rs 2,000", "Rs 3,000", "Rs 12,000"], 1, "data interpretation", "medium", "Savings rise from 10,000 to 12,000, an increase of Rs 2,000.", { table: budgetTable }),
  Q("The table shows production at two plants. What was the total production of Plant P over the three years, in thousands?", ["160", "165", "170", "180"], 2, "data interpretation", "easy", "40 + 55 + 75 = 170.", { table: plantTable }),
  Q("The table shows production at two plants. In which year was the gap between the plants the largest?", ["2022", "2023", "2024", "Same every year"], 2, "data interpretation", "medium", "Gaps are 10, 10 and 15 thousand. The largest is in 2024.", { table: plantTable }),
  Q("The table shows production at two plants. By what percentage did Plant Q grow from 2022 to 2024?", ["10%", "20%", "25%", "30%"], 1, "data interpretation", "medium", "(60 - 50) / 50 = 0.2, a 20% rise.", { table: plantTable }),
];

function withIds(prefix, questions) {
  return questions.map((q, i) => ({ ...q, id: `${prefix}${i + 1}` }));
}

function pick(list, indexes) {
  return indexes.map((i) => list[i]);
}

export function seedSets() {
  const now = new Date().toISOString();
  const quant = withIds("qa", quantitative);
  const logic = withIds("lr", logical);
  const verb = withIds("va", verbal);
  const di = withIds("di", dataInterpretation);
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
  return [
    make("seed_lightning", "Lightning Round (demo)", "Five quick questions, 10 seconds each. Ideal for a first game.", 10, [quant[0], logic[0], verb[0], di[0], quant[7]]),
    make("seed_mix", "Placement Mix 1", "24 mixed questions across all four topics, the way a real placement test feels.", 20, [
      ...pick(quant, [1, 2, 3, 5, 8, 13]),
      ...pick(logic, [1, 3, 5, 7, 10, 13]),
      ...pick(verb, [1, 3, 4, 8, 9, 10]),
      ...pick(di, [1, 2, 5, 6, 8, 10]),
    ]),
    make("seed_quant", "Quantitative Aptitude Pack", "Arithmetic, percentages, ratios, time and work, probability.", 25, quant),
    make("seed_logic", "Logical Reasoning Pack", "Series, coding, directions, blood relations, syllogisms, clocks and calendars.", 25, logic),
    make("seed_verbal", "Verbal Ability Pack", "Vocabulary, grammar, idioms and sentence correction.", 15, verb),
    make("seed_di", "Data Interpretation Pack", "Tables with percentages, averages and growth.", 30, di),
  ];
}
