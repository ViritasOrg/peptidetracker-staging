# Body-fat measurement uncertainty — the source behind `_BC_PRECISION`

Supplied by Henrik, 2026-09-18, as the background to the precision-vs-body-fat chart
that the per-method error bars in Body Comp were first built from.

**Why this file exists.** The margins of error in `_BC_PRECISION` (`tab-body.js`) were
originally read off a JPEG of that chart by eye, and the code said so. An error bar is a
claim about how much to trust a number, so a claim read off a picture is the wrong
footing for it. This is the text the chart was drawn from, kept verbatim so the anchors
can be checked against something other than a screenshot.

**What it is not.** The document below gives a flat Standard Error of Estimate per
method. The chart — and therefore `_BC_PRECISION` — is body-fat DEPENDENT, which is the
whole point of it: the tape and the calipers are at their best around 20% and fall apart
at both ends. Section 3 gives the mechanism for that (the Taylor expansion under US
Navy, the subcutaneous-ratio assumption under calipers), not a replacement for it. Where
an anchor and an SEE ceiling disagree, the SEE is the flat central estimate and the
anchor is a point on a curve; only an anchor OUTSIDE the documented envelope is a
mistake, and those were corrected against this text.

Sections 1 and 2 are cycle and transition material rather than measurement material.
They are kept because they arrived as one document and splitting a source is how the
half nobody quoted goes missing.

---

```
================================================================================
          CYCLE PROTOCOL, TRANSITION SCHEDULE & BODYFAT UNCERTAINTY
================================================================================

--------------------------------------------------------------------------------
SECTION 1: 24-WEEK CYCLE & TRANSITION OVERVIEW
--------------------------------------------------------------------------------

1. CORE CYCLE STRUCTURE (WEEKS 1–24)
   - Base Phase (Weeks 1–16):
     * Testosterone Enanthate: 350 mg / week
     * Masteron Enanthate:     200 mg / week
     * Human Growth Hormone:   Daily administration (2–4 IU)
     * Retatrutide:            6 mg / week
   - Finishing Pulse (Weeks 17–24):
     * Testosterone Enanthate: 350 mg / week
     * Masteron Enanthate:     200 mg / week
     * Trenbolone Enanthate:   150 mg / week
     * Human Growth Hormone:   Daily administration
     * Retatrutide:            6 mg / week

2. HEALTH & BLOODWORK CHECKPOINTS
   - Daily Monitoring: Blood pressure (Target: <= 125/70 mmHg) and fasting glucose.
   - Pre-Masteron / Transition Panel (Week 4):
     * Sensitive Estradiol (LC-MS/MS), CBC (Hematocrit), Lipids, Fasting Glucose/HbA1c.
   - Pre-Trenbolone Panel (Week 16):
     * Lipids (HDL/LDL baseline), CBC, Renal markers (Cystatin-C/BUN/Creatinine), ALT/AST.
   - Mid-Tren Pulse Panel (Week 20):
     * Prolactin, Sensitive E2, Blood Pressure, Lipids.

3. POST-CYCLE RECOVERY / CRUISE (WEEK 25+)
   - Strategy: Drop down to true replacement/health restoration dose.
   - Dose: 100–125 mg / week Testosterone alone for 12–16 weeks.
   - Objective: Normalize HDL/LDL lipids, clear hematocrit elevation, lower systemic
     shear stress, and resensitize androgen receptors.


--------------------------------------------------------------------------------
SECTION 2: TEST U TO TEST E TRANSITION SCHEDULE (6-WEEK OVERLAP)
--------------------------------------------------------------------------------

- Cadence: Every Other Day (EOD) — averages 3.5 injections / week.
- Concentrations: Test U = 250 mg/ml | Test E = 250 mg/ml
- Step Granularity: Strict 0.1 ml steps (1 Step = 0.1 ml = 25 mg).

+-------------+----------------+----------------+----------------+--------------------------+
| Phase/Weeks | Test U per Shot| Test E per Shot| Syringe Volume | Active Exogenous Load/Wk |
+-------------+----------------+----------------+----------------+--------------------------+
| Weeks 1–2   | 0.2 ml (50 mg) | 0.1 ml (25 mg) | 0.3 ml total   | 175 mg U + 87.5 mg E     |
| Weeks 3–4   | 0.1 ml (25 mg) | 0.2 ml (50 mg) | 0.3 ml total   | 87.5 mg U + 175 mg E     |
| Week 5      | 0.0 ml (Stop U)| 0.3 ml (75 mg) | 0.3 ml total   | 0 mg U + 262.5 mg E      |
| Week 6+     | 0.0 ml         | 0.4 ml (100mg) | 0.4 ml total   | 350 mg Test E Steady State|
+-------------+----------------+----------------+----------------+--------------------------+

Loading & Execution Notes:
- Weeks 1–2: Draw Test U to 0.2 ml, then pull Test E to the 0.3 ml mark.
- Weeks 3–4: Draw Test U to 0.1 ml, then pull Test E to the 0.3 ml mark.
- Week 5: Stop Test U completely. Draw Test E to 0.3 ml.
- Week 6+: Draw Test E to 0.4 ml (100 mg per shot EOD = 350 mg/week).
- Week 6+ Masteron Blend: Draw 0.4 ml Test E, then pull Masteron into the same syringe.


--------------------------------------------------------------------------------
SECTION 3: MATHEMATICAL MODELING OF BODY FAT MEASUREMENT UNCERTAINTY
--------------------------------------------------------------------------------

1. DUAL-ENERGY X-RAY ABSORPTIOMETRY (DEXA)
-------------------------------------------
Model: 3-Compartment System (Bone Mineral Content, Fat-Free Soft Tissue, Fat Mass).
X-ray attenuation according to Beer-Lambert Law:
    I(E) = I_0(E) * exp( - sum_i( mu_i(E) * t_i ) )

Ratio of attenuation coefficients in soft tissue (R-value):
    R = mu_soft(E_L) / mu_soft(E_H) = alpha * R_fat + (1 - alpha) * R_lean

Solving for fat mass fraction (alpha):
    alpha = (R - R_lean) / (R_fat - R_lean)

Uncertainty & Error Sources:
- Hydration State Variance: Assumes constant lean tissue hydration of 73.2%.
  Shift in hydration (delta_h) yields systematic error:
    delta_%BF ≈ -0.7 * delta_h_hydration
- Beam Hardening: Tissue thickness > 25 cm increases scatter and attenuation variance.
- Precision Metrics:
    Standard Error of Estimate (SEE) ≈ 1.2% - 2.5% BF (vs 4-Compartment model)
    Coefficient of Variation (CV) = (SD / mean) * 100 ≈ 0.8% - 1.5%

References:
[1] Pietrobelli, A., et al. (1996). Dual-energy X-ray absorptiometry body composition 
    model: review of physical concepts. Am J Physiol Endocrinol Metab, 271(6), E941-E951.
[2] Toombs, R. J., et al. (2012). The impact of recent diet and fluid intake on technical 
    and biological measurement error in DEXA. Eur J Clin Nutr, 66(1), 115–121.


2. US NAVY CIRCUMFERENCE METHOD
--------------------------------
Model: Geometric shape estimation (cylinders/cones) derived from circumferences.
Body Density (D_B in g/cm^3) for Males:
    D_B = 1.0324 - 0.19077 * log10(C_A - C_N) + 0.15456 * log10(H)
    (C_A = Abdominal circumference, C_N = Neck circumference, H = Height in cm)

Body Density (D_B) for Females:
    D_B = 1.02492 - 0.29669 * log10(C_A + C_H - C_N) + 0.22100 * log10(H)
    (C_H = Hip circumference)

Conversion to %BF via Siri Equation:
    %BF = (4.95 / D_B - 4.50) * 100

Uncertainty & Error Sources:
- Error Propagation via Taylor Expansion (where x = C_A - C_N):
    sigma_(D_B)^2 = ( d(D_B) / dx )^2 * sigma_x^2 
                  = ( -0.19077 / (x * ln(10)) )^2 * sigma_x^2
  Sensitivity expands non-linearly as x decreases (magnifying error in lean individuals).
- Structural Shape Bias: Atypical visceral/subcutaneous ratios or abdominal muscularity 
  yield systematic bias (> 4% - 6% BF).
- Precision Metrics:
    Standard Error of Estimate (SEE) ≈ 3.5% - 4.5% BF.

References:
[1] Hodgdon, J. A., & Beckett, M. B. (1984). Prediction of percent body fat for U.S. Navy 
    men and women from body circumferences and height. NAVHLTHRESCEN Report 84-29.
[2] Siri, W. E. (1961). Body composition from fluid spaces and density: analysis of methods. 
    Tech Meas Body Comp, 61, 223–244.


3. SKINFOLD CALIPER METHOD
---------------------------
Model: Subcutaneous fat fold sum S = sum_{k=1}^n s_k (in mm).
Jackson-Pollock 3-Site Male Model (Chest, Abdomen, Thigh):
    D_B = 1.109380 - 0.0008267*(S) + 0.0000016*(S)^2 - 0.0002574*(Age)

Conversion to %BF via Brožek Equation:
    %BF = (4.57 / D_B - 4.142) * 100

Uncertainty & Error Sources:
- Internal-to-Subcutaneous Ratio Assumption: Assumes subcutaneous fat is fixed at ~50% 
  of total fat. Age/visceral fat shifts introduce structural bias:
    Bias = f( FM_visceral / FM_subcutaneous )
- Inter-Tester & Compression Error:
    sigma_(inter-tester)^2 ≈ 2.5% - 4.0% BF variance.
- Precision Metrics:
    Standard Error of Estimate (SEE) ≈ 3.0% - 4.0% BF (Skilled) to > 5.0% BF (Untrained).

References:
[1] Jackson, A. S., & Pollock, M. L. (1978). Generalized equations for predicting body 
    density of men. Br J Nutr, 40(3), 497–504.
[2] Lohman, T. G. (1981). Skinfold thickness and body density and their relation to body 
    fatness: a review. Hum Biol, 181–225.


4. COMPUTER VISION & AI IMAGE ANALYSIS
--------------------------------------
Model Frameworks:
1. Convolutional Regression:
    y_hat = f_theta(X),  where X in R^(H x W x 3)
2. Parametric 3D Mesh Reconstruction (e.g., SMPL Model):
    Mesh M(beta, theta) generated from shape parameters beta in R^10 and pose theta in R^72.
    Body volume V_body integrated over closed mesh boundary partial_Omega:
        V_body = (1/6) * sum_{f in Faces} v_(f,1) . (v_(f,2) x v_(f,3))

Uncertainty & Error Sources:
- Optical Perspective Distortion: Scale ambiguity from camera distance d_z and focal length f:
    V_estimated proportional to (d_z / f)^3 * V_true
- Input Perturbations: Clothing, posture, and shading act as input noise delta:
    f_theta(X + delta) != f_theta(X)
- Out-of-Distribution (OOD) Bias: High epistemic uncertainty on body shapes not heavily 
  represented in the training set (e.g., hyper-muscular/low fat).
- Precision Metrics:
    Standard Error of Estimate (SEE) ≈ 2.5% - 4.5% BF.

References:
[1] Majmudar, M. D., et al. (2020). Validation of a smartphone-based 3D body scanning 
    technology for body composition assessment. NPJ Digit Med, 3(1), 1–8.
[2] Loper, M., et al. (2015). SMPL: A skinned multi-person linear model. ACM Trans Graph, 
    34(6), 1–16.

================================================================================
```

---

## What the app took from Section 3

`tab-body.js` holds two tables derived from this text.

`_BC_SEE` — the flat Standard Error of Estimate envelope each method is documented at,
with the model it comes from and its references. This is what the app can honestly say
about a method in general.

`_BC_PRECISION` — the body-fat-dependent curve, which is what an individual reading
actually gets an error bar from. Anchored on the chart, bounded by the envelope above.

### Reconciliation, 2026-09-18

Two anchors from the original eyeball read sat above the documented SEE ceiling, both at
the extreme left edge of the chart where a pixel read is least reliable:

| method | anchor | was | now | documented ceiling |
|---|---|---|---|---|
| `navy` | 40% BF | 4.7 | 4.5 | 4.5 (SEE 3.5–4.5) |
| `ai`   | 40% BF | 4.8 | 4.5 | 4.5 (SEE 2.5–4.5) |

Everything else already sat inside its envelope and was left alone. The caliper curve
reaching 6.9 at 5% BF is NOT out of bounds: the flat SEE for a skilled tester is 3.0–4.0,
but Section 3 names the mechanism that breaks it at the ends, and > 5.0 is documented for
a tester working outside their competence — which, at 5% body fat, describes almost
everyone holding a caliper.

DEXA stays at a flat 1.5, inside its documented 1.2–2.5.
