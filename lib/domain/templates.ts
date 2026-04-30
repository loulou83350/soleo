/**
 * Modèles de sessions de recherche prédéfinis.
 * Structure plate : chaque template est un tableau de blocs ordonnés.
 * Le premier bloc est toujours 'welcome', le dernier 'thank_you'.
 */

import type { BlockType } from '@/lib/db/schema';

export type TemplateBlock = {
  blockType: BlockType;
  config: Record<string, unknown>;
  required: boolean;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  blocks: TemplateBlock[];
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
    blocks: [
      {
        blockType: 'welcome',
        config: {
          title: 'Test d\'utilisabilité',
          description: 'Vous allez tester un prototype. Essayez d\'accomplir la tâche décrite naturellement, comme si vous utilisiez le produit réel.',
          buttonText: 'Commencer',
        },
        required: false,
      },
      {
        blockType: 'short_text',
        config: { question: 'Quel est votre rôle principal ?', placeholder: 'Ex : Designer, Développeur…' },
        required: false,
      },
      {
        blockType: 'prototype_task',
        config: { url: '', instructions: 'Essayez d\'accomplir la tâche suivante : [décrivez la tâche ici]' },
        required: false,
      },
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
      {
        blockType: 'thank_you',
        config: { title: 'Merci !', description: 'Vos retours nous aident à améliorer le produit.' },
        required: false,
      },
    ],
  },

  // ─── 2. Sondage de satisfaction ─────────────────────────────────────────────
  {
    id: 'satisfaction-survey',
    name: 'Sondage de satisfaction',
    description: 'Mesurez la satisfaction globale, identifiez les points de friction et collectez des pistes d\'amélioration.',
    category: 'Sondage',
    estimatedMinutes: 5,
    blocks: [
      {
        blockType: 'welcome',
        config: {
          title: 'Sondage de satisfaction',
          description: 'Ce court sondage vous prendra environ 5 minutes. Vos réponses nous aident à améliorer notre produit.',
          buttonText: 'Commencer',
        },
        required: false,
      },
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
      {
        blockType: 'thank_you',
        config: { title: 'Merci pour vos retours !', description: 'Votre avis contribue directement à l\'amélioration du produit.' },
        required: false,
      },
    ],
  },

  // ─── 3. Tri de cartes ────────────────────────────────────────────────────────
  {
    id: 'card-sort',
    name: 'Tri de cartes',
    description: 'Comprenez comment vos utilisateurs organisent l\'information pour optimiser votre architecture de contenu.',
    category: 'Architecture',
    estimatedMinutes: 15,
    blocks: [
      {
        blockType: 'welcome',
        config: {
          title: 'Tri de cartes',
          description: 'Vous allez voir une série de cartes représentant des contenus. Regroupez-les de la façon qui vous semble la plus logique. Il n\'y a pas de bonne ou mauvaise réponse !',
          buttonText: 'Commencer',
        },
        required: false,
      },
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
      {
        blockType: 'short_text',
        config: {
          question: 'Avez-vous eu des hésitations sur le classement de certaines cartes ? Lesquelles et pourquoi ?',
          placeholder: 'Vos commentaires…',
        },
        required: false,
      },
      {
        blockType: 'thank_you',
        config: { title: 'Merci !', description: 'Vos réponses nous aident à mieux organiser notre contenu.' },
        required: false,
      },
    ],
  },

  // ─── 4. Test premier regard ──────────────────────────────────────────────────
  {
    id: 'first-impression',
    name: 'Test premier regard',
    description: 'Mesurez l\'impact visuel immédiat d\'un design : ce que les participants remarquent en quelques secondes.',
    category: 'Design',
    estimatedMinutes: 5,
    blocks: [
      {
        blockType: 'welcome',
        config: {
          title: 'Test premier regard',
          description: 'Vous allez voir une image pendant quelques secondes. Observez-la attentivement, puis répondez aux questions qui suivront.',
          buttonText: 'Je suis prêt(e)',
        },
        required: false,
      },
      {
        blockType: 'first_impression',
        config: {
          imageUrl: '',
          duration: 5,
          instructions: 'Vous allez voir une image pendant 5 secondes. Observez-la attentivement.',
        },
        required: false,
      },
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
      {
        blockType: 'thank_you',
        config: { title: 'Merci !', description: 'Vos impressions nous aident à améliorer nos designs.' },
        required: false,
      },
    ],
  },

  // ─── 5. Entretien utilisateur guidé ──────────────────────────────────────────
  {
    id: 'user-interview',
    name: 'Entretien utilisateur',
    description: 'Collectez des insights qualitatifs profonds sur les besoins, habitudes et frustrations de vos utilisateurs.',
    category: 'Entretien',
    estimatedMinutes: 20,
    blocks: [
      {
        blockType: 'welcome',
        config: {
          title: 'Entretien utilisateur',
          description: 'Merci de prendre le temps de répondre à ces questions. Vos retours nous sont précieux pour améliorer notre produit.',
          buttonText: 'Commencer',
        },
        required: false,
      },
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
      {
        blockType: 'thank_you',
        config: { title: 'Merci pour votre temps !', description: 'Vos retours nous aident à construire un meilleur produit.' },
        required: false,
      },
    ],
  },
];

export const TEMPLATE_MAP = new Map(TEMPLATES.map((t) => [t.id, t]));
