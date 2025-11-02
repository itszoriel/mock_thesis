"""Seed remote Render database with baseline document types and benefit programs.

Run with:
    python scripts/seed_render_data.py --database-url <postgresql://...>

The script is idempotent: existing rows are updated using their unique codes.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Iterable, List

import psycopg
from psycopg.types.json import Json


@dataclass
class Municipality:
    id: int
    name: str
    slug: str


def fetch_municipalities(conn: psycopg.Connection) -> List[Municipality]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, slug FROM municipalities ORDER BY id;")
        return [Municipality(id=row[0], name=row[1], slug=row[2]) for row in cur.fetchall()]


def seed_document_types(conn: psycopg.Connection) -> int:
    document_types = [
        {
            "code": "BRGY-CLEARANCE",
            "name": "Barangay Clearance",
            "description": "Certification from the barangay attesting to good standing and absence of pending cases.",
            "authority_level": "barangay",
            "requirements": [
                "Valid government-issued ID",
                "Proof of residency (utility bill or barangay ID)",
                "Community Tax Certificate (Cedula)"
            ],
            "fee": Decimal("80.00"),
            "processing_days": 2,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "BRGY-RESIDENCY",
            "name": "Certificate of Residency",
            "description": "Proof from the barangay confirming residency for at least six (6) months.",
            "authority_level": "barangay",
            "requirements": [
                "Valid government-issued ID",
                "Barangay family profile sheet (if available)"
            ],
            "fee": Decimal("0.00"),
            "processing_days": 2,
            "supports_physical": True,
            "supports_digital": True,
            "is_active": True,
        },
        {
            "code": "BRGY-INDIGENCY",
            "name": "Certificate of Indigency",
            "description": "Certification required for medical, burial, or educational assistance requests.",
            "authority_level": "barangay",
            "requirements": [
                "Valid ID of applicant",
                "Barangay household profile",
                "Supporting document stating the purpose of request"
            ],
            "fee": Decimal("0.00"),
            "processing_days": 2,
            "supports_physical": True,
            "supports_digital": True,
            "is_active": True,
        },
        {
            "code": "BRGY-SOLOPARENT",
            "name": "Solo Parent Certification",
            "description": "Barangay-issued certification endorsing solo parents for DSWD benefits.",
            "authority_level": "barangay",
            "requirements": [
                "Valid ID",
                "Birth certificates of children",
                "Affidavit of being a solo parent"
            ],
            "fee": Decimal("0.00"),
            "processing_days": 3,
            "supports_physical": True,
            "supports_digital": True,
            "is_active": True,
        },
        {
            "code": "BRGY-BUSINESS",
            "name": "Barangay Business Clearance",
            "description": "Pre-requisite clearance from the barangay for business registration or renewal.",
            "authority_level": "barangay",
            "requirements": [
                "Previous year barangay clearance (for renewals)",
                "DTI/SEC/CDA registration",
                "Lease contract or proof of business address"
            ],
            "fee": Decimal("150.00"),
            "processing_days": 3,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "BRGY-ID",
            "name": "Barangay Identification Card",
            "description": "Issuance or renewal of official barangay identification card.",
            "authority_level": "barangay",
            "requirements": [
                "Completed barangay ID form",
                "Two 1x1 ID photos",
                "Proof of residency"
            ],
            "fee": Decimal("50.00"),
            "processing_days": 4,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "MUN-MAYOR-PERMIT",
            "name": "Mayor's Permit",
            "description": "Local business permit issued annually by the municipal mayor's office.",
            "authority_level": "municipal",
            "requirements": [
                "Barangay Business Clearance",
                "DTI/SEC/CDA registration",
                "Lease contract or tax declaration of business site"
            ],
            "fee": Decimal("500.00"),
            "processing_days": 5,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "MUN-BUSINESS-RENEW",
            "name": "Business Permit Renewal",
            "description": "Annual renewal for existing businesses within the municipality.",
            "authority_level": "municipal",
            "requirements": [
                "Previous mayor's permit",
                "Audited financial statement or gross sales report",
                "Barangay clearance for the current year"
            ],
            "fee": Decimal("650.00"),
            "processing_days": 5,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "MUN-CEDULA",
            "name": "Community Tax Certificate (Cedula)",
            "description": "Community tax certificate required for various government transactions.",
            "authority_level": "municipal",
            "requirements": [
                "Valid ID",
                "Previous cedula (if renewal)",
                "Income declaration"
            ],
            "fee": Decimal("100.00"),
            "processing_days": 1,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "MUN-HEALTH-CERT",
            "name": "Municipal Health Certificate",
            "description": "Certificate issued by the Municipal Health Office after physical examination.",
            "authority_level": "municipal",
            "requirements": [
                "Barangay clearance",
                "Recent 1x1 photo",
                "Laboratory results (if required)"
            ],
            "fee": Decimal("200.00"),
            "processing_days": 3,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "MUN-BIRTH-CERT",
            "name": "Birth Certificate (Local Civil Registry)",
            "description": "Certified true copy of birth certificate filed within the municipality.",
            "authority_level": "municipal",
            "requirements": [
                "Valid ID of requester",
                "Authorization letter if representative",
                "Details of birth record (name, date, parents)"
            ],
            "fee": Decimal("120.00"),
            "processing_days": 4,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "MUN-MARRIAGE-LIC",
            "name": "Marriage License Application",
            "description": "Application for marriage license issued by the Municipal Civil Registry Office.",
            "authority_level": "municipal",
            "requirements": [
                "Birth certificates of both applicants",
                "Certificate of No Marriage (CENOMAR)",
                "Pre-marriage counseling certificate"
            ],
            "fee": Decimal("150.00"),
            "processing_days": 10,
            "supports_physical": True,
            "supports_digital": False,
            "is_active": True,
        },
        {
            "code": "MUN-SCHOLAR-ENDORSE",
            "name": "Scholarship Endorsement Certificate",
            "description": "Certification from the municipal mayor supporting scholarship applications to the province or TESDA.",
            "authority_level": "municipal",
            "requirements": [
                "Barangay certificate of residency",
                "Latest report card or TOR",
                "Letter of intent"
            ],
            "fee": Decimal("0.00"),
            "processing_days": 3,
            "supports_physical": True,
            "supports_digital": True,
            "is_active": True,
        },
        {
            "code": "MUN-NO-ARREARS",
            "name": "Certificate of No Property Tax Arrears",
            "description": "Certification from the Municipal Treasurer that the taxpayer has no outstanding real property taxes.",
            "authority_level": "municipal",
            "requirements": [
                "Property tax declaration",
                "Valid ID",
                "Latest official receipt"
            ],
            "fee": Decimal("0.00"),
            "processing_days": 3,
            "supports_physical": True,
            "supports_digital": True,
            "is_active": True,
        },
    ]

    with conn.cursor() as cur:
        inserted = 0
        for doc in document_types:
            payload = doc.copy()
            payload["requirements"] = Json(doc.get("requirements"))

            cur.execute(
                """
                INSERT INTO document_types
                    (code, name, description, authority_level, requirements, fee, processing_days,
                     supports_physical, supports_digital, is_active)
                VALUES
                    (%(code)s, %(name)s, %(description)s, %(authority_level)s, %(requirements)s,
                     %(fee)s, %(processing_days)s, %(supports_physical)s, %(supports_digital)s, %(is_active)s)
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    authority_level = EXCLUDED.authority_level,
                    requirements = EXCLUDED.requirements,
                    fee = EXCLUDED.fee,
                    processing_days = EXCLUDED.processing_days,
                    supports_physical = EXCLUDED.supports_physical,
                    supports_digital = EXCLUDED.supports_digital,
                    is_active = EXCLUDED.is_active,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id;
                """,
                payload,
            )
            cur.fetchone()
            inserted += 1
    conn.commit()
    return inserted


def build_benefit_templates(muni: Municipality) -> Iterable[dict]:
    slug_prefix = muni.slug.replace("-", "_").upper()
    now_year = datetime.utcnow().year
    application_start = datetime(now_year, 1, 1, 0, 0, 0)
    application_end = datetime(now_year, 12, 31, 23, 59, 0)

    return [
        {
            "code": f"{slug_prefix}_MEDCARE_{now_year}",
            "name": f"{muni.name} Medical Assistance Program",
            "description": "Subsidy for emergency medical procedures and medicines for indigent residents registered in PhilHealth or DOH programs.",
            "program_type": "health",
            "application_start": application_start,
            "application_end": application_end,
            "benefit_amount": Decimal("5000.00"),
            "benefit_description": "Reimbursable medical expenses up to ₱5,000 per qualified resident per year.",
            "eligibility_criteria": {
                "residency": "At least one (1) year residency in the municipality",
                "income_bracket": "Household monthly income not exceeding ₱15,000",
                "philhealth": "Active PhilHealth or PhilHealth Konsulta registration"
            },
            "required_documents": [
                "Barangay Certificate of Indigency",
                "Medical abstract or doctor's prescription",
                "PhilHealth Member Data Record"
            ],
            "max_beneficiaries": 300,
        },
        {
            "code": f"{slug_prefix}_LIVELIHOOD_{now_year}",
            "name": f"{muni.name} Livelihood Starter Kits",
            "description": "Provision of starter kits or capital assistance for micro-entrepreneurs affected by disasters or economic displacement.",
            "program_type": "livelihood",
            "application_start": application_start,
            "application_end": application_end,
            "benefit_amount": Decimal("8000.00"),
            "benefit_description": "Starter toolkit or cash grant valued up to ₱8,000 for approved business proposals.",
            "eligibility_criteria": {
                "residency": "Registered voter or barangay resident for at least two (2) years",
                "priority": "Displaced workers, fisherfolk, and solo parents",
                "training": "Completion of LGU livelihood orientation seminar"
            },
            "required_documents": [
                "Business or project proposal",
                "Barangay clearance",
                "Proof of displacement or income loss"
            ],
            "max_beneficiaries": 150,
        },
        {
            "code": f"{slug_prefix}_SCHOLAR_{now_year}",
            "name": f"{muni.name} Senior High & College Scholarship",
            "description": "Financial assistance for deserving students enrolled in public or state universities within Zambales.",
            "program_type": "education",
            "application_start": application_start,
            "application_end": application_end,
            "benefit_amount": Decimal("6000.00"),
            "benefit_description": "Allowance of ₱6,000 per semester released upon submission of grades.",
            "eligibility_criteria": {
                "gpa": "General weighted average of 85% or 2.0 equivalent",
                "income_bracket": "Combined parents' annual income not exceeding ₱180,000",
                "residency": "Resident of the municipality for at least three (3) years"
            },
            "required_documents": [
                "Certified true copy of grades",
                "Certificate of good moral character",
                "Parents' latest income tax return or BIR Form 2316"
            ],
            "max_beneficiaries": 120,
        },
        {
            "code": f"{slug_prefix}_DISASTER_{now_year}",
            "name": f"{muni.name} Disaster Recovery Cash Grant",
            "description": "Immediate cash assistance for households whose homes or livelihoods are damaged by typhoons or flooding events.",
            "program_type": "social",
            "application_start": application_start,
            "application_end": application_end,
            "benefit_amount": Decimal("7000.00"),
            "benefit_description": "One-time cash grant of up to ₱7,000 released within 15 days from validation.",
            "eligibility_criteria": {
                "damage_assessment": "Validated damage report from MDRRMO",
                "residency": "Resident of an affected barangay as certified by the Punong Barangay",
                "income_priority": "Priority given to families under the Listahanan database"
            },
            "required_documents": [
                "Barangay certification of damage",
                "Photos of damaged property",
                "Government-issued ID of household head"
            ],
            "max_beneficiaries": 200,
        },
    ]


def seed_benefit_programs(conn: psycopg.Connection, municipalities: Iterable[Municipality]) -> int:
    total = 0
    with conn.cursor() as cur:
        for muni in municipalities:
            for template in build_benefit_templates(muni):
                payload = {
                    "code": template["code"],
                    "name": template["name"],
                    "description": template["description"],
                    "program_type": template["program_type"],
                    "municipality_id": muni.id,
                    "benefit_amount": template["benefit_amount"],
                    "benefit_description": template["benefit_description"],
                    "eligibility_criteria": Json(template["eligibility_criteria"]),
                    "required_documents": Json(template["required_documents"]),
                    "application_start": template["application_start"],
                    "application_end": template["application_end"],
                    "max_beneficiaries": template["max_beneficiaries"],
                    "current_beneficiaries": 0,
                    "is_active": True,
                    "is_accepting_applications": True,
                    "duration_days": 365,
                }

                cur.execute(
                    """
                    INSERT INTO benefit_programs
                        (code, name, description, program_type, municipality_id, eligibility_criteria,
                         required_documents, application_start, application_end, benefit_amount,
                         benefit_description, max_beneficiaries, current_beneficiaries,
                         is_active, is_accepting_applications, duration_days)
                    VALUES
                        (%(code)s, %(name)s, %(description)s, %(program_type)s, %(municipality_id)s,
                         %(eligibility_criteria)s, %(required_documents)s, %(application_start)s,
                         %(application_end)s, %(benefit_amount)s, %(benefit_description)s,
                         %(max_beneficiaries)s, %(current_beneficiaries)s, %(is_active)s,
                         %(is_accepting_applications)s, %(duration_days)s)
                    ON CONFLICT (code) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        program_type = EXCLUDED.program_type,
                        municipality_id = EXCLUDED.municipality_id,
                        eligibility_criteria = EXCLUDED.eligibility_criteria,
                        required_documents = EXCLUDED.required_documents,
                        application_start = EXCLUDED.application_start,
                        application_end = EXCLUDED.application_end,
                        benefit_amount = EXCLUDED.benefit_amount,
                        benefit_description = EXCLUDED.benefit_description,
                        max_beneficiaries = EXCLUDED.max_beneficiaries,
                        is_active = EXCLUDED.is_active,
                        is_accepting_applications = EXCLUDED.is_accepting_applications,
                        duration_days = EXCLUDED.duration_days,
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    payload,
                )
                total += 1
    conn.commit()
    return total


def seed_issue_categories(conn: psycopg.Connection) -> int:
    categories = [
        {
            "name": "Technical Problem",
            "slug": "technical-problem",
            "description": "Portal bugs, QR errors, or any MunLink system issue.",
            "icon": "cpu",
        },
        {
            "name": "Infrastructure",
            "slug": "infrastructure",
            "description": "Roads, bridges, streetlights, traffic signals, and similar concerns.",
            "icon": "road",
        },
        {
            "name": "Utilities & Services",
            "slug": "utilities-services",
            "description": "Water, electricity, sanitation, and waste management issues.",
            "icon": "plug",
        },
        {
            "name": "Public Safety",
            "slug": "public-safety",
            "description": "Crime reports, accidents, fire hazards, or suspicious activity.",
            "icon": "shield",
        },
        {
            "name": "Health & Sanitation",
            "slug": "health-sanitation",
            "description": "Health center concerns, vaccination drives, and cleanliness.",
            "icon": "heart-pulse",
        },
        {
            "name": "Community Services",
            "slug": "community-services",
            "description": "Livelihood, benefits distribution, or barangay-level services.",
            "icon": "users",
        },
        {
            "name": "Environmental Concern",
            "slug": "environmental-concern",
            "description": "Flooding, drainage, illegal dumping, tree cutting, and similar issues.",
            "icon": "leaf",
        },
        {
            "name": "Other / General Inquiry",
            "slug": "other",
            "description": "For reports that do not match the predefined categories.",
            "icon": "message-circle",
        },
    ]

    total = 0
    with conn.cursor() as cur:
        for cat in categories:
            payload = {
                "name": cat["name"],
                "slug": cat["slug"],
                "description": cat["description"],
                "icon": cat["icon"],
            }
            cur.execute(
                """
                INSERT INTO issue_categories (name, slug, description, icon, is_active)
                VALUES (%(name)s, %(slug)s, %(description)s, %(icon)s, TRUE)
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    icon = EXCLUDED.icon,
                    is_active = EXCLUDED.is_active
                ;
                """,
                payload,
            )
            total += 1
    conn.commit()
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Render Postgres with baseline data")
    parser.add_argument("--database-url", required=True, help="PostgreSQL connection URL")
    args = parser.parse_args()

    conn = psycopg.connect(args.database_url)
    try:
        municipalities = fetch_municipalities(conn)
        if not municipalities:
            raise RuntimeError("No municipalities found. Run base migrations and seed municipalities first.")

        doc_count = seed_document_types(conn)
        benefit_count = seed_benefit_programs(conn, municipalities)
        category_count = seed_issue_categories(conn)

        print(
            "Seed complete:"
            f" {doc_count} document types,"
            f" {benefit_count} benefit programs,"
            f" {category_count} issue categories."
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()


