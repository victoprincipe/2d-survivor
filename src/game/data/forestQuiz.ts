export const FOREST_QUESTIONS = [
  // Forest types: https://acta.inpa.gov.br/fasciculos/36-1/BODY/v36n1a05.html
  {
    text: 'O que caracteriza uma floresta de terra firme na Amazônia?',
    options: ['É alagada diariamente pelas marés', 'Não sofre as inundações dos rios', 'Cresce apenas em solos arenosos', 'Só existe nas margens dos rios'],
    correct: 1,
  },
  {
    text: 'As florestas de várzea são inundadas principalmente por qual tipo de água?',
    options: ['Água salgada', 'Água de rios de águas pretas', 'Água subterrânea sem sedimentos', 'Água de rios de águas brancas, rica em sedimentos'],
    correct: 3,
  },
  {
    text: 'Qual formação florestal está associada às inundações de rios de águas pretas, como o Rio Negro?',
    options: ['Igapó', 'Terra firme', 'Manguezal', 'Floresta de araucárias'],
    correct: 0,
  },
  {
    text: 'Qual produto da seringueira é usado na fabricação da borracha natural?',
    options: ['A polpa do fruto', 'O óleo das sementes', 'O látex', 'O pólen das flores'],
    correct: 2,
  },
  {
    text: 'Qual é o papel dos fungos e das bactérias decompositoras no solo da floresta?',
    options: ['Impedir a absorção de água pelas raízes', 'Reciclar nutrientes ao decompor matéria orgânica', 'Transformar toda matéria orgânica em areia', 'Substituir a fotossíntese das árvores'],
    correct: 1,
  },
] as const;

export interface ForestQuizView {
  status: 'question' | 'failed' | 'rewarded';
  index: number;
  total: number;
  text: string;
  options: readonly string[];
}

/** Answers and reward eligibility belong to the engine, not the modal. */
export class ForestQuiz {
  private index = 0;
  private failed = false;
  constructor(private rewarded = false) {}

  begin(): ForestQuizView {
    if (!this.rewarded) { this.index = 0; this.failed = false; }
    return this.view();
  }

  answer(choice: number): boolean {
    if (this.failed || this.rewarded || !Number.isInteger(choice) || choice < 0 || choice >= FOREST_QUESTIONS[this.index].options.length) return false;
    if (choice !== FOREST_QUESTIONS[this.index].correct) { this.failed = true; return false; }
    if (this.index < FOREST_QUESTIONS.length - 1) { this.index++; return false; }
    this.rewarded = true;
    return true;
  }

  view(): ForestQuizView {
    return {
      status: this.rewarded ? 'rewarded' : this.failed ? 'failed' : 'question',
      index: this.index, total: FOREST_QUESTIONS.length,
      text: FOREST_QUESTIONS[this.index].text, options: FOREST_QUESTIONS[this.index].options,
    };
  }
}
