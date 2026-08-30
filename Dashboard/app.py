import os
import json
import pandas as pd
import numpy as np
from flask import Flask, render_template, jsonify, request
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split

app = Flask(__name__)

# Global ML Model Variables & Strategies
tfidf_vectorizer = None
trained_svm = None
class_labels = ['Salary Hike', 'Flexible Work', 'Manager Change', 'Promotion', 'Role Change', 'Not Applicable']

action_strategies = {
    'Salary Hike': {
        'title': 'Compensation & Financial Incentive Adjustment',
        'badge_class': 'badge-salary',
        'strategy': 'Conduct an immediate market compensation review. Prepare a competitive salary adjustment or retention bonus proposal to align with industry benchmarks.',
        'urgency': 'High',
        'icon': 'fa-sack-dollar'
    },
    'Flexible Work': {
        'title': 'Work-Life Balance & Remote Work Arrangement',
        'badge_class': 'badge-flexible',
        'strategy': 'Offer hybrid or fully remote work options, flexible working hours, or reduced shift hours to alleviate burnout and improve work-life harmony.',
        'urgency': 'Medium',
        'icon': 'fa-house-laptop'
    },
    'Manager Change': {
        'title': 'Team Transfer & Leadership Alignment',
        'badge_class': 'badge-manager',
        'strategy': 'Initiate an internal transfer to a new reporting manager or department. Conduct confidential 1-on-1 feedback sessions to resolve team dynamic issues.',
        'urgency': 'High',
        'icon': 'fa-users-gear'
    },
    'Promotion': {
        'title': 'Career Progression & Title Upgrade',
        'badge_class': 'badge-promotion',
        'strategy': 'Accelerate the performance review cycle. Provide a clear career advancement roadmap, title promotion, and leadership opportunity within the project.',
        'urgency': 'High',
        'icon': 'fa-arrow-trend-up'
    },
    'Role Change': {
        'title': 'Internal Job Transfer & Skill Realignment',
        'badge_class': 'badge-role',
        'strategy': 'Explore internal job rotation to align with the employee’s skill set and long-term career aspirations. Offer specialized domain training.',
        'urgency': 'Medium',
        'icon': 'fa-repeat'
    },
    'Not Applicable': {
        'title': 'Exit Review & Knowledge Transfer',
        'badge_class': 'badge-na',
        'strategy': 'The attrition reason relates to non-negotiable personal factors (e.g. relocation, family commitments). Focus on smooth offboarding and knowledge transfer.',
        'urgency': 'Low',
        'icon': 'fa-circle-info'
    }
}

# File path for dataset
CSV_PATH = os.path.join(os.path.dirname(__file__), 'Hr_Retention.csv')

def init_prediction_model():
    global tfidf_vectorizer, trained_svm, class_labels
    if tfidf_vectorizer is not None:
        return
    try:
        model_pkl_path = os.path.join(os.path.dirname(__file__), 'retention_action_model.pkl')
        if os.path.exists(model_pkl_path):
            import pickle
            with open(model_pkl_path, 'rb') as f:
                bundle = pickle.load(f)
            if isinstance(bundle, dict):
                tfidf_vectorizer = bundle.get('vectorizer')
                trained_svm = bundle.get('model')
                class_labels = bundle.get('classes', class_labels)
                print("Dashboard Prediction Model loaded from pre-trained bundle!")
        else:
            print("Warning: retention_action_model.pkl not found. Run train_model.py to generate model file.")
    except Exception as e:
        print("Prediction Model load error:", str(e))

# Cache the DataFrame
df_raw = None

def load_data():
    global df_raw
    df_raw = pd.read_csv(CSV_PATH)
    if 'Gender' in df_raw.columns:
        df_raw = df_raw[df_raw['Gender'].astype(str).str.strip().str.lower().isin(['male', 'female'])].copy()
    if 'Year' not in df_raw.columns:
        if 'HireDate' in df_raw.columns:
            df_raw['Year'] = pd.to_datetime(df_raw['HireDate']).dt.year
        elif 'HireYear' in df_raw.columns:
            df_raw['Year'] = df_raw['HireYear']
        elif 'YearsAtCompany' in df_raw.columns:
            df_raw['Year'] = 2025 - df_raw['YearsAtCompany']
    init_prediction_model()
    return df_raw

def filter_dataframe(df):
    active_filters = {}
    
    param_map = {
        'dept': 'Department',
        'gender': 'Gender',
        'overtime': 'OverTime',
        'role': 'JobRole',
        'hire_year': 'Year',
        'year': 'Year',
        'reason_cat': 'Reason_Category',
        'attempted': 'Retention_Attempted',
        'action_taken': 'Retention_Action_Taken',
        'retained': 'Retained'
    }
    
    req_data = request.json if (request.is_json and request.json) else request.args
    
    # 1. Single click filter_col & filter_val
    f_col = req_data.get('filter_col')
    f_val = req_data.get('filter_val')
    if f_col and f_val and str(f_val) != 'All' and f_col in df.columns:
        df = df[df[f_col].astype(str) == str(f_val)]
        active_filters[f_col] = str(f_val)
        
    # 2. Multi-field dropdown filters
    for p_name, col_name in param_map.items():
        val = req_data.get(p_name)
        if val and str(val) != 'All' and col_name in df.columns:
            df = df[df[col_name].astype(str) == str(val)]
            active_filters[col_name] = str(val)
            
    return df, active_filters

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/columns')
def get_columns():
    df = load_data()
    
    options = {}
    filter_cols = ['Department', 'JobRole', 'Gender', 'OverTime', 'Year', 'HireYear', 'Reason_Category', 'Retention_Attempted', 'Retention_Action_Taken', 'Retained']
    for col in filter_cols:
        if col in df.columns:
            unique_vals = [str(x) for x in df[col].dropna().unique() if str(x) != 'nan' and str(x) != 'NA']
            if col in ['Year', 'HireYear']:
                unique_vals = sorted([int(float(x)) for x in unique_vals], reverse=True)
            else:
                unique_vals = sorted(unique_vals)
            options[col] = unique_vals
            
    return jsonify({
        'options': options,
        'all': list(df.columns)
    })

@app.route('/api/overview')
def get_overview():
    raw_df = load_data()
    df, active_filters = filter_dataframe(raw_df)
    
    total_employees = len(df)
    resigned_df = df[df['Attrition'] == 'Yes']
    total_resigned = len(resigned_df)
    attrition_rate = round((total_resigned / total_employees) * 100, 2) if total_employees > 0 else 0
    avg_income = round(float(df['MonthlyIncome'].mean()), 2) if total_employees > 0 else 0
    avg_age = round(float(df['Age'].mean()), 1) if total_employees > 0 else 0
    avg_satisfaction = round(float(df['JobSatisfaction'].mean()), 2) if total_employees > 0 else 0
    avg_work_life = round(float(df['WorkLifeBalance'].mean()), 2) if total_employees > 0 else 0
    
    # Department breakdown
    dept_stats = []
    if 'Department' in df.columns:
        for dept, group in df.groupby('Department'):
            dept_total = len(group)
            dept_attrition = len(group[group['Attrition'] == 'Yes'])
            dept_rate = round((dept_attrition / dept_total) * 100, 1) if dept_total > 0 else 0
            avg_dept_income = round(float(group['MonthlyIncome'].mean()), 0) if dept_total > 0 else 0
            dept_stats.append({
                'department': str(dept),
                'total': dept_total,
                'resigned': dept_attrition,
                'attrition_rate': dept_rate,
                'avg_income': avg_dept_income
            })
    dept_stats = sorted(dept_stats, key=lambda x: x['total'], reverse=True)
    
    # Attrition by Gender
    gender_stats = []
    if 'Gender' in df.columns:
        for gender, group in df.groupby('Gender'):
            g_total = len(group)
            g_attrition = len(group[group['Attrition'] == 'Yes'])
            gender_stats.append({
                'gender': str(gender),
                'total': g_total,
                'resigned': g_attrition,
                'attrition_rate': round((g_attrition / g_total) * 100, 1) if g_total > 0 else 0
            })
        
    # Attrition by JobRole (Top 8)
    role_stats = []
    if 'JobRole' in df.columns:
        for role, group in df.groupby('JobRole'):
            r_total = len(group)
            r_attrition = len(group[group['Attrition'] == 'Yes'])
            role_stats.append({
                'role': str(role),
                'total': r_total,
                'resigned': r_attrition,
                'attrition_rate': round((r_attrition / r_total) * 100, 1) if r_total > 0 else 0
            })
    role_stats = sorted(role_stats, key=lambda x: x['attrition_rate'], reverse=True)[:8]

    # Attrition by OverTime
    overtime_stats = []
    if 'OverTime' in df.columns:
        for ot, group in df.groupby('OverTime'):
            ot_total = len(group)
            ot_attrition = len(group[group['Attrition'] == 'Yes'])
            overtime_stats.append({
                'overtime': str(ot),
                'total': ot_total,
                'resigned': ot_attrition,
                'attrition_rate': round((ot_attrition / ot_total) * 100, 1) if ot_total > 0 else 0
            })

    # Year trend
    hireyear_stats = []
    year_col = 'Year' if 'Year' in df.columns else ('HireYear' if 'HireYear' in df.columns else None)
    if year_col:
        for year, group in df.groupby(year_col):
            tot = len(group)
            res = len(group[group['Attrition'] == 'Yes'])
            rate = round((res / tot) * 100, 1) if tot > 0 else 0
            hireyear_stats.append({
                'year': int(float(year)),
                'total_hires': tot,
                'resigned': res,
                'attrition_rate': rate
            })
    hireyear_stats = sorted(hireyear_stats, key=lambda x: x['year'])

    return jsonify({
        'active_filters': active_filters,
        'kpis': {
            'total_employees': total_employees,
            'total_resigned': total_resigned,
            'attrition_rate': attrition_rate,
            'avg_income': avg_income,
            'avg_age': avg_age,
            'avg_satisfaction': avg_satisfaction,
            'avg_work_life': avg_work_life
        },
        'departments': dept_stats,
        'genders': gender_stats,
        'roles': role_stats,
        'overtime': overtime_stats,
        'hire_years': hireyear_stats,
        'years': hireyear_stats
    })

@app.route('/api/retention')
def get_retention():
    raw_df = load_data()
    df, active_filters = filter_dataframe(raw_df)
    
    resigned_df = df[df['Attrition'] == 'Yes']
    total_resigned = len(resigned_df)
    
    attempt_counts = resigned_df['Retention_Attempted'].value_counts().to_dict() if 'Retention_Attempted' in resigned_df.columns else {}
    attempted_yes = int(attempt_counts.get('Yes', 0))
    attempt_rate = round((attempted_yes / total_resigned) * 100, 1) if total_resigned > 0 else 0
    
    retained_df = resigned_df[resigned_df['Retention_Attempted'] == 'Yes'] if 'Retention_Attempted' in resigned_df.columns else pd.DataFrame()
    retained_counts = retained_df['Retained'].value_counts().to_dict() if not retained_df.empty and 'Retained' in retained_df.columns else {}
    retained_yes = int(retained_counts.get('Yes', 0))
    retention_success_rate = round((retained_yes / len(retained_df)) * 100, 1) if len(retained_df) > 0 else 0
    
    reason_cats = resigned_df['Reason_Category'].value_counts().fillna('Unspecified').to_dict() if 'Reason_Category' in resigned_df.columns else {}
    reason_list = [{'category': str(k), 'count': int(v)} for k, v in reason_cats.items()]
    reason_list = sorted(reason_list, key=lambda x: x['count'], reverse=True)
    
    action_stats = []
    if 'Retention_Action_Taken' in resigned_df.columns:
        attempted_actions = resigned_df[resigned_df['Retention_Action_Taken'].notna() & (resigned_df['Retention_Action_Taken'] != 'NA')]
        for action, group in attempted_actions.groupby('Retention_Action_Taken'):
            total_act = len(group)
            retained_act = len(group[group['Retained'] == 'Yes']) if 'Retained' in group.columns else 0
            success_pct = round((retained_act / total_act) * 100, 1) if total_act > 0 else 0
            action_stats.append({
                'action': str(action),
                'total_attempted': total_act,
                'successful_retained': retained_act,
                'success_rate': success_pct
            })
    action_stats = sorted(action_stats, key=lambda x: x['total_attempted'], reverse=True)

    sample_exits = []
    if 'Exit_Reason_HR_Recorded' in resigned_df.columns:
        exit_records = resigned_df[resigned_df['Exit_Reason_HR_Recorded'].notna()].head(20)
        for _, row in exit_records.iterrows():
            sample_exits.append({
                'employee_id': str(row['EmployeeID']),
                'department': str(row['Department']),
                'job_role': str(row['JobRole']),
                'monthly_income': int(row['MonthlyIncome']),
                'reason_category': str(row['Reason_Category']) if pd.notna(row['Reason_Category']) else 'General',
                'hr_recorded_reason': str(row['Exit_Reason_HR_Recorded']),
                'retention_attempted': str(row['Retention_Attempted']),
                'action_taken': str(row['Retention_Action_Taken']),
                'retained': str(row['Retained']),
                'outcome_reason': str(row['Retention_Outcome_Reason'])
            })

    return jsonify({
        'active_filters': active_filters,
        'kpis': {
            'total_resigned': total_resigned,
            'attempted_yes': attempted_yes,
            'attempt_rate': attempt_rate,
            'retained_yes': retained_yes,
            'retention_success_rate': retention_success_rate
        },
        'reason_categories': reason_list,
        'action_effectiveness': action_stats,
        'exit_records': sample_exits
    })

@app.route('/api/custom-chart', methods=['POST'])
def generate_custom_chart():
    df = load_data()
    data = request.json or {}
    
    chart_type = data.get('chart_type', 'bar')
    x_col = data.get('x_axis', 'Department')
    y_col = data.get('y_axis', 'MonthlyIncome')
    agg_func = data.get('agg_func', 'mean')
    filter_dept = data.get('filter_dept', 'All')
    filter_attrition = data.get('filter_attrition', 'All')
    
    # Global filter support
    filtered_df, active_filters = filter_dataframe(df)
    
    if filter_dept != 'All' and 'Department' in filtered_df.columns:
        filtered_df = filtered_df[filtered_df['Department'] == filter_dept]
    if filter_attrition != 'All' and 'Attrition' in filtered_df.columns:
        filtered_df = filtered_df[filtered_df['Attrition'] == filter_attrition]
        
    if filtered_df.empty:
        return jsonify({'error': 'No data matches the selected filters.'}), 400
        
    labels = []
    values = []
    
    if y_col == '__COUNT__':
        counts = filtered_df[x_col].value_counts()
        labels = [str(k) for k in counts.index]
        values = [int(v) for v in counts.values]
    elif y_col == '__ATTRITION_RATE__':
        grouped_stats = []
        for val, group in filtered_df.groupby(x_col):
            tot = len(group)
            att = len(group[group['Attrition'] == 'Yes'])
            rate = round((att / tot) * 100, 2) if tot > 0 else 0
            grouped_stats.append((str(val), rate))
        grouped_stats = sorted(grouped_stats, key=lambda x: x[1], reverse=True)
        labels = [g[0] for g in grouped_stats]
        values = [g[1] for g in grouped_stats]
    else:
        if y_col in filtered_df.columns and x_col in filtered_df.columns:
            if agg_func == 'mean':
                res = filtered_df.groupby(x_col)[y_col].mean()
            elif agg_func == 'sum':
                res = filtered_df.groupby(x_col)[y_col].sum()
            elif agg_func == 'median':
                res = filtered_df.groupby(x_col)[y_col].median()
            elif agg_func == 'max':
                res = filtered_df.groupby(x_col)[y_col].max()
            elif agg_func == 'min':
                res = filtered_df.groupby(x_col)[y_col].min()
            else:
                res = filtered_df.groupby(x_col)[y_col].mean()
                
            labels = [str(k) for k in res.index]
            values = [round(float(v), 2) for v in res.values]

    return jsonify({
        'chart_type': chart_type,
        'x_axis': x_col,
        'y_axis': y_col,
        'agg_func': agg_func,
        'labels': labels,
        'values': values,
        'total_categories': len(labels),
        'max_value': max(values) if values else 0,
        'min_value': min(values) if values else 0,
        'avg_value': round(float(np.mean(values)), 2) if values else 0
    })

@app.route('/api/predict', methods=['POST'])
def predict_retention_action():
    load_data()
    try:
        req_data = request.get_json(silent=True) or request.form
        text = req_data.get('text', '').strip()
        if not text:
            return jsonify({'error': 'Please provide employee feedback or exit reason text.'}), 400

        if tfidf_vectorizer is not None and trained_svm is not None:
            text_vec = tfidf_vectorizer.transform([text])
            prediction = trained_svm.predict(text_vec)[0]
            probs = trained_svm.predict_proba(text_vec)[0]
            prob_dict = {cls: float(p) for cls, p in zip(trained_svm.classes_, probs)}
        else:
            prediction = 'Not Applicable'
            prob_dict = {cls: 0.16 for cls in class_labels}

        confidence_pct = round(prob_dict.get(prediction, 0.0) * 100, 1)
        strategy_info = action_strategies.get(prediction, action_strategies['Not Applicable'])
        prob_breakdown = [
            {
                'action': cls,
                'probability': round(prob_dict.get(cls, 0.0) * 100, 1),
                'badge_class': action_strategies.get(cls, {}).get('badge_class', 'badge-na')
            }
            for cls in sorted(prob_dict.keys(), key=lambda x: prob_dict[x], reverse=True)
        ]

        return jsonify({
            'status': 'success',
            'input_text': text,
            'prediction': prediction,
            'confidence': confidence_pct,
            'strategy_info': strategy_info,
            'probabilities': prob_breakdown
        })
    except Exception as e:
        print("Prediction error:", str(e))
        return jsonify({'error': f"Error processing prediction: {str(e)}"}), 500

@app.route('/api/predict-samples', methods=['GET'])
def get_prediction_samples():
    return jsonify([
        {
            'category': 'Compensation & Pay',
            'text': 'Employee felt underpaid compared to market standards and requested a salary review after taking on additional responsibilities.'
        },
        {
            'category': 'Work-Life Balance',
            'text': 'Reported severe burnout due to high workload, mandatory weekend shifts, and continuous long working hours over the past 6 months.'
        },
        {
            'category': 'Manager Conflict',
            'text': 'Cited lack of support, poor communication, and recognition issues with the direct team manager.'
        },
        {
            'category': 'Career Advancement',
            'text': 'Felt there were no growth opportunities or title promotions available within the current project team.'
        },
        {
            'category': 'Relocation / Personal',
            'text': 'Spouse received a job transfer to another state requiring family relocation.'
        }
    ])

if __name__ == '__main__':
    print("Starting HR Analytics Flask Server on http://127.0.0.1:5000 ...")
    app.run(debug=True, port=5000)
