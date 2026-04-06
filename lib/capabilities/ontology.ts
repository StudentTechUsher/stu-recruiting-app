export const CAPABILITY_ONTOLOGY_VERSION = "2026.04.v1";
export const CAPABILITY_SCORING_VERSION = "2026.04.fit.v1";

export type CapabilityAxisDefinition = {
  axis_id: string;
  label: string;
  is_active: boolean;
};

const AXIS_DEFINITIONS: CapabilityAxisDefinition[] = [
  { axis_id: "communication", label: "Communication", is_active: true },
  { axis_id: "collaboration", label: "Collaboration", is_active: true },
  { axis_id: "execution_reliability", label: "Execution Reliability", is_active: true },
  { axis_id: "execution", label: "Execution", is_active: true },
  { axis_id: "technical_depth", label: "Technical Depth", is_active: true },
  { axis_id: "systems_thinking", label: "Systems Thinking", is_active: true },
  { axis_id: "data_management", label: "Data Management", is_active: true },
  { axis_id: "product_analytics", label: "Product Analytics", is_active: true },
  { axis_id: "research_methodology", label: "Research Methodology", is_active: true },
  { axis_id: "leadership", label: "Leadership", is_active: true },
  { axis_id: "other_evidence", label: "Other Evidence", is_active: true },
  { axis_id: "problem_solving", label: "Problem Solving", is_active: true },
  { axis_id: "business_judgment", label: "Business Judgment", is_active: true },
  { axis_id: "data_communication", label: "Data Communication", is_active: true },
  { axis_id: "operational_coordination", label: "Operational Coordination", is_active: true },
];

const AXIS_BY_ID = new Map<string, CapabilityAxisDefinition>(
  AXIS_DEFINITIONS.map((axis) => [axis.axis_id, axis])
);

export const getCapabilityOntologyAxes = (): CapabilityAxisDefinition[] => AXIS_DEFINITIONS.slice();

export const getCapabilityAxisDefinition = (axisId: string): CapabilityAxisDefinition | null =>
  AXIS_BY_ID.get(axisId.trim()) ?? null;

export const isKnownCapabilityAxis = (axisId: string): boolean => AXIS_BY_ID.has(axisId.trim());

export const isActiveCapabilityAxis = (axisId: string): boolean => {
  const definition = AXIS_BY_ID.get(axisId.trim());
  return Boolean(definition?.is_active);
};
