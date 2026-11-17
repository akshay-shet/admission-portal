// Reference data (boards / courses / combinations) copied from the original portal,
// The portal starts with no students or payments.

export const SEED = {
  boards: [
    { id: 'b1', board_name: 'BISE', level: 'PUC' },
    { id: 'b2', board_name: 'BOSSE', level: 'SSLC' },
    { id: 'b3', board_name: 'BOSSE', level: 'PUC' },
    { id: 'b7', board_name: 'KSOU', level: 'Degree' },
  ],
  courses: [
    ['c5', 'B.COM'], ['c6', 'BA'], ['c7', 'BBA'], ['c8', 'BCA'], ['c9', 'BSC'],
    ['c10', 'MA'], ['c11', 'M.COM'], ['c12', 'M.B.A'], ['c13', 'M.C.A'],
  ].map(([id, course_name]) => ({ id, course_name, level: 'Degree' })),
  combinations: [
    ['m1', 'PCMC', 'PUC'], ['m3', 'PCMB', 'PUC'], ['m5', 'CEBA', 'PUC'], ['m6', 'HEBA', 'PUC'],
    ['m7', 'HEPS', 'PUC'], ['m8', 'SSLC', ''], ['m10', 'BOSSE', ''],
  ].map(([id, combination_name, level]) => ({ id, combination_name, level })),
  // no sample students or payments: the portal starts empty
  sslc_students: [], puc_students: [], degree_students: [], pg_students: [], installments: [],
};
