export const JOB_LIST_DEFAULT_LIMIT = 20;
export const JOB_LIST_MAX_LIMIT = 50;
export const JOB_TITLE_MAX = 200;
export const JOB_DESCRIPTION_MAX = 8000;
export const JOB_COMPANY_NAME_MAX = 200;
export const JOB_LOCATION_MAX = 120;
export const JOB_COVER_MESSAGE_MAX = 2000;
export const JOB_APPLICATION_CONSENT_VERSION_MAX = 120;

/** Applications are stored in-platform only; external employer delivery is not configured. */
export const JOB_EMPLOYER_DELIVERY = {
  status: "NOT_CONFIGURED" as const,
  message:
    "Applications are recorded in StrangeUp only. Delivery to the employer or an external ATS is not configured.",
};
