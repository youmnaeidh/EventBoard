"""5-fold cross-validated evaluation of the forecast model.

Writes data/model_metrics.json (served in the model card) and prints it. Re-run after changing the
model or the training data.
"""
import json
from pathlib import Path

from app.forecast import ForecastModel, load_training_frame

model = ForecastModel().fit(load_training_frame(), evaluate="cv")
out = Path(__file__).resolve().parent.parent / "data" / "model_metrics.json"
out.write_text(json.dumps(model.card["metrics"], ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(model.card["metrics"], ensure_ascii=False, indent=2))
