import type { AlternativeTerminvorschlaege, Rueckmeldungen, Teilnehmer, Terminvorschlaege } from './app';

export type EnrichedTerminvorschlaege = Terminvorschlaege & {
  terminabstimmungName: string;
};

export type EnrichedTeilnehmer = Teilnehmer & {
  terminabstimmungName: string;
};

export type EnrichedRueckmeldungen = Rueckmeldungen & {
  terminabstimmungName: string;
  terminvorschlagName: string;
  teilnehmerName: string;
};

export type EnrichedAlternativeTerminvorschlaege = AlternativeTerminvorschlaege & {
  terminabstimmungName: string;
  vorgeschlagen_vonName: string;
};
