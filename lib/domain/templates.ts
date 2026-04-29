/**
 * Modèles de sessions de recherche prédéfinis.
 * Chaque template décrit les pages et blocs initiaux à créer.
 */

import type { BlockType } from '@/lib/db/schema';

export type TemplateBlock = {
  blockType: BlockType;
  config: Record<string, unknown>;
  required: boolean;
};

export type TemplatePage = {
  title: string;
  pageType: 'intro' | 'question' | 'end';
  blocks: TemplateBlock[];
};

export type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  pages: TemplatePage[];
};

// ─── Les 5 templates ──────────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [
  // ─── 1. Test d'utilisabilité ────────────────────────────────────────────────
  {
    id: 'usability-test',
    name: 'Test d\'utilisabilité',
    description: 'Évaluez un prototype Figma ou une interface live avec une tâche guidée et des questions de retour.',
    category: 'Prototype',
    estimatedMinutes: 10,
    pages: [
      { title: 'Introduction', pageType: 'intro', blocks: [] },
      {
        title: 'Contexte',
        pageType: 'question',
        blocks: [
          {
            blockType: 'content',
            config: {
              title: 'Bienvenue dans cette étude',
              body: 'Vous allez tester un prototype. Essayez d\'accomplir la tâche décrite naturellement, comme si vous utilisiez le produit réel.',
            },
            required: false,
          },
          {
            blockType: 'short_text',
            config: { question: 'Quel est votre rôle principal ?', placeholder: 'Ex : Designer, Développeur…' },
            required: false,
          },
        ],
      },
      {
        title: 'Tâche prototype',
        pageType: 'question',
        blocks: [
          {
            blockType: 'prototype_task',
            config: { url: '', instructions: 'Essayez d\'accomplir la tâche suivante : [décrivez la tâche ici]' },
            required: false,
          },
        ],
      },
      {
        title: 'Retour',
        pageType: 'question',
        blocks: [
          {
            blockType: 'short_text',
            config: { question: 'Qu\'avez-vous trouvé facile ou intuitif ?', placeholder: 'Vos impressions…' },
            required: false,
          },
          {
            blockType: 'short_text',
            config: { question: 'Qu\'est-ce qui vous a posé problème ou semblait confus ?', placeholder: 'Vos difficultés…' },
            required: false,
          },
          {
            blockType: 'nps',
            config: {
              question: 'Dans quelle mesure recommanderiez-vous ce produit à un collègue ou ami ?',
              lowLabel: 'Pas du tout probable',
              highLabel: 'Très probable',
            },
            required: false,
          },
        ],
      },
      { title: 'Fin', pageType: 'end', blocks: [] },
    ],
  },

  // ─── 2. Sondage de satisfaction ─────────────────────────────────────────────
  {
    id: 'satisfaction-survey',
    name: 'Sondage de satisfaction',
    description: 'Mesurez la satisfaction globale, identifiez les points de friction et collectez des pistes d\'amélioration.',
    category: 'Sondage',
    estimatedMinutes: 5,
    pages: [
      { title: 'Introduction', pageType: 'intro', blocks: [] },
      {
        title: 'Satisfaction',
        pageType: 'question',
        blocks: [
          {
            blockType: 'nps',
            config: {
              question: 'Dans quelle mesure recommanderiez-vous notre produit à quelqu\'un que vous connaissez ?',
              lowLabel: 'Pas du tout probable',
              highLabel: 'Extrêmement probable',
            },
            required: true,
          },
          {
            blockType: 'likert',
            config: {
              question: 'Globalement, êtes-vous satisfait(e) de notre produit ?',
              scale: 5,
              lowLabel: 'Très insatisfait(e)',
              highLabel: 'Très satisfait(e)',
            },
            required: true,
          },
        ],
      },
      {
        title: 'Retour détaillé',
        pageType: 'question',
        blocks: [
          {
            blockType: 'mcq',
            config: {
              question: 'Quelles fonctionnalités utilisez-vous le plus ?',
              options: ['Fonctionnalité A', 'Fonctionnalité B', 'Fonctionnalité C', 'Autre'],
              allowMultiple: true,
              randomize: false,
              allowOther: false,
            },
            required: false,
          },
          {
            blockType: 'long_text',
            config: {
              question: 'Qu\'est-ce qui pourrait être amélioré dans notre produit ?',
              placeholder: 'Partagez vos idées librement…',
              aiFollowUp: false,
              maxTurns: 1,
            },
            required: false,
          },
        ],
      },
      { title: 'Fin', pageType: 'end', blocks: [] },
    ],
  },

  // ─── 3. Tri de cartes ────────────────────────────────────────────────────────
  {
    id: 'card-sort',
    name: 'Tri de cartes',
    description: 'Comprenez comment vos utilisateurs organisent l\'information pour optimiser votre architecture de contenu.',
    category: 'Architecture',
    estimatedMinutes: 15,
    pages: [
      { title: 'Introduction', pageType: 'intro', blocks: [] },
      {
        title: 'Instructions',
        pageType: 'question',
        blocks: [
          {
            blockType: 'content',
            config: {
              title: 'Comment réaliser ce tri de cartes',
              body: 'Vous allez voir une série de cartes représentant des contenus. Regroupez-les de la façon qui vous semble la plus logique. Il n\'y a pas de bonne ou mauvaise réponse !',
            },
            required: false,
          },
        ],
      },
      {
        title: 'Tri des cartes',
        pageType: 'question',
        blocks: [
          {
            blockType: 'card_sort',
            config: {
              question: 'Regroupez ces cartes selon la logique qui vous semble la plus naturelle.',
              items: [
                { label: 'Carte 1' },
                { label: 'Carte 2' },
                { label: 'Carte 3' },
                { label: 'Carte 4' },
                { label: 'Carte 5' },
              ],
            },
            required: false,
          },
        ],
      },
      {
        title: 'Feedback',
        pageType: 'question',
        blocks: [
          {
            blockType: 'short_text',
            config: {
              question: 'Avez-vous eu des hésitations sur le classement de certaines cartes ? Lesquelles et pourquoi ?',
              placeholder: 'Vos commentaires…',
            },
            required: false,
          },
        ],
      },
      { title: 'Fin', pageType: 'end', blocks: [] },
    ],
  },

  // ─── 4. Test premier regard ──────────────────────────────────────────────────
  {
    id: 'first-impression',
    name: 'Test premier regard',
    description: 'Mesurez l\'impact visuel immédiat d\'un design : ce que les participants remarquent en quelques secondes.',
    category: 'Design',
    estimatedMinutes: 5,
    pages: [
      { title: 'Introduction', pageType: 'intro', blocks: [] },
      {
        title: 'Impression',
        pageType: 'question',
        blocks: [
          {
            blockType: 'first_impression',
            config: {
              imageUrl: '',
              duration: 5,
              instructions: 'Vous allez voir une image pendant 5 secondes. Observez-la attentivement, puis répondez aux questions suivantes.',
            },
            required: false,
          },
        ],
      },
      {
        title: 'Questions',
        pageType: 'question',
        blocks: [
          {
            blockType: 'short_text',
            config: {
              question: 'Qu\'avez-vous remarqué en premier ?',
              placeholder: 'Décrivez votre première impression…',
            },
            required: true,
          },
          {
            blockType: 'short_text',
            config: {
              question: 'De quoi pensez-vous que ce design fait la promotion ou parle ?',
              placeholder: 'Votre interprétation…',
            },
            required: false,
          },
          {
            blockType: 'likert',
            config: {
              question: 'Ce design vous inspire-t-il confiance ?',
              scale: 5,
              lowLabel: 'Pas du tout',
              highLabel: 'Tout à fait',
            },
            required: false,
          },
        ],
      },
      { title: 'Fin', pageType: 'end', blocks: [] },
    ],
  },

  // ─── 5. Entretien utilisateur guidé ──────────────────────────────────────────
  {
    id: 'user-interview',
    name: 'Entretien utilisateur',
    description: 'Collectez des insights qualitatifs profonds sur les besoins, habitudes et frustrations de vos utilisateurs.',
    category: 'Entretien',
    estimatedMinutes: 20,
    pages: [
      { title: 'Introduction', pageType: 'intro', blocks: [] },
      {
        title: 'Profil',
        pageType: 'question',
        blocks: [
          {
            blockType: 'short_text',
            config: { question: 'Décrivez votre rôle et votre contexte professionnel.', placeholder: 'Ex : Product Manager dans une startup SaaS…' },
            required: false,
          },
          {
            blockType: 'mcq',
            config: {
              question: 'Depuis combien de temps utilisez-vous ce type de produit ?',
              options: ['Moins de 6 mois', '6 mois à 2 ans', '2 à 5 ans', 'Plus de 5 ans'],
              allowMultiple: false,
              randomize: false,
              allowOther: false,
            },
            required: false,
          },
        ],
      },
      {
        title: 'Habitudes actuelles',
        pageType: 'question',
        blocks: [
          {
            blockType: 'long_text',
            config: {
              question: 'Comment résolvez-vous actuellement [le problème que votre produit adresse] ? Décrivez votre processus.',
              placeholder: 'Décrivez vos outils, étapes et habitudes…',
              aiFollowUp: false,
              maxTurns: 1,
            },
            required: false,
          },
          {
            blockType: 'short_text',
            config: {
              question: 'Quel est votre principal point de friction dans ce processus ?',
              placeholder: 'Ce qui vous frustre le plus…',
            },
            required: false,
          },
        ],
      },
      {
        title: 'Attentes & idéal',
        pageType: 'question',
        blocks: [
          {
            blockType: 'rating',
            config: { question: 'Sur 5, comment évalueriez-vous votre satisfaction avec vos outils actuels ?', max: 5 },
            required: false,
          },
          {
            blockType: 'long_text',
            config: {
              question: 'Si vous pouviez concevoir la solution idéale, à quoi ressemblerait-elle ?',
              placeholder: 'Soyez aussi précis(e) que vous le souhaitez…',
              aiFollowUp: false,
              maxTurns: 1,
            },
            required: false,
          },
        ],
      },
      { title: 'Fin', pageType: 'end', blocks: [] },
    ],
  },
];

export const TEMPLATE_MAP = new Map(TEMPLATES.map((t) => [t.id, t]));
