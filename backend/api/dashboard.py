"""
Dashboard API Endpoints for KKT Services Expiration Management System

This module provides dashboard statistics and summary endpoints with Redis caching:
- GET /api/dashboard/summary - Dashboard statistics and urgent deadlines
- GET /api/dashboard/stats - Simple stats for new frontend
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import date, timedelta
from typing import List, Optional

from backend.database import get_db
from backend.models import User, Deadline, DeadlineType, CashRegister
from backend.schemas import DashboardSummary, StatusBreakdown, UrgentDeadline
from backend.dependencies import get_current_active_user
from backend.cache import cache, CacheKeys


# Create API router
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _calculate_dashboard_stats(db: Session) -> dict:
    """Calculate dashboard statistics (shared logic)"""
    today = date.today()
    yellow_threshold = today + timedelta(days=14)
    red_threshold = today + timedelta(days=7)
    
    # Total Clients
    total_clients = db.query(func.count(User.id))                      .filter(User.role == 'client')                      .scalar() or 0
    
    # Active Clients
    active_clients = db.query(func.count(User.id))                       .filter(User.role == 'client', User.is_active == True)                       .scalar() or 0
    
    # Total Deadlines
    total_deadlines = db.query(func.count(Deadline.id)).scalar() or 0
    
    # Total Cash Registers
    total_cash_registers = db.query(func.count(CashRegister.id)).filter(CashRegister.is_active == True).scalar() or 0
    
    # Status Breakdown
    green_count = db.query(func.count(Deadline.id))                    .filter(Deadline.status == 'active', Deadline.expiration_date >= yellow_threshold)                    .scalar() or 0
    
    yellow_count = db.query(func.count(Deadline.id))                     .filter(Deadline.status == 'active',
                             Deadline.expiration_date >= red_threshold,
                             Deadline.expiration_date < yellow_threshold)                     .scalar() or 0
    
    red_count = db.query(func.count(Deadline.id))                  .filter(Deadline.status == 'active',
                          Deadline.expiration_date >= today,
                          Deadline.expiration_date < red_threshold)                  .scalar() or 0
    
    expired_count = db.query(func.count(Deadline.id))                      .filter(Deadline.status == 'active', Deadline.expiration_date < today)                      .scalar() or 0
    
    return {
        'total_clients': total_clients,
        'active_clients': active_clients,
        'total_deadlines': total_deadlines,
        'total_cash_registers': total_cash_registers,
        'status_green': green_count,
        'status_yellow': yellow_count,
        'status_red': red_count,
        'status_expired': expired_count,
    }


@router.get("/stats", summary="Get Dashboard Stats (New Frontend)")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get dashboard statistics optimized for new React frontend.
    Results are cached for 60 seconds.
    """
    # Try cache first
    cached_stats = cache.get(CacheKeys.DASHBOARD_SUMMARY)
    if cached_stats:
        return cached_stats
    
    # Calculate stats
    stats = _calculate_dashboard_stats(db)
    
    # Cache for 60 seconds
    cache.set(CacheKeys.DASHBOARD_SUMMARY, stats, ttl=60)
    
    return stats


@router.get("/summary", response_model=DashboardSummary, summary="Get Dashboard Summary")
async def get_dashboard_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve dashboard statistics and urgent deadlines (legacy endpoint).
    Results are cached for 60 seconds.
    """
    today = date.today()
    
    # Get cached stats or calculate
    stats = _calculate_dashboard_stats(db)
    
    status_breakdown = StatusBreakdown(
        green=stats['status_green'],
        yellow=stats['status_yellow'],
        red=stats['status_red'],
        expired=stats['status_expired']
    )
    
    # Urgent Deadlines (Top 10 expiring soonest)
    urgent_deadlines_query = db.query(
        User.company_name.label('client_name'),
        DeadlineType.type_name.label('deadline_type'),
        Deadline.expiration_date
    ).join(User)     .join(DeadlineType)     .filter(Deadline.status == 'active', Deadline.expiration_date >= today)     .order_by(Deadline.expiration_date)     .limit(10)     .all()
    
    urgent_deadlines = []
    for row in urgent_deadlines_query:
        days_remaining = int((row.expiration_date - today).days)
        client_display = row.client_name if row.client_name else "Клиент"
        urgent_deadlines.append(UrgentDeadline(
            client_name=client_display,
            deadline_type=row.deadline_type,
            expiration_date=row.expiration_date,
            days_remaining=days_remaining
        ))
    
    return DashboardSummary(
        total_clients=stats['total_clients'],
        active_clients=stats['active_clients'],
        total_deadlines=stats['total_deadlines'],
        status_breakdown=status_breakdown,
        urgent_deadlines=urgent_deadlines
    )


@router.get("/stats/by-type", summary="Get Statistics by Deadline Type")
async def get_stats_by_type(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get deadline statistics grouped by deadline type"""
    # Try cache
    cached = cache.get(CacheKeys.DASHBOARD_STATS_BY_TYPE)
    if cached:
        return cached
    
    today = date.today()
    
    stats = db.query(
        DeadlineType.type_name,
        func.count(Deadline.id).label('total_count'),
        func.sum(case((Deadline.status == 'active', 1), else_=0)).label('active_count'),
        func.sum(case((Deadline.expiration_date < today, 1), else_=0)).label('expired_count')
    ).outerjoin(Deadline)     .group_by(DeadlineType.id, DeadlineType.type_name)     .all()
    
    result = []
    for stat in stats:
        result.append({
            'type_name': stat.type_name,
            'total_count': stat.total_count or 0,
            'active_count': int(stat.active_count or 0),
            'expired_count': int(stat.expired_count or 0)
        })
    
    # Cache for 60 seconds
    cache.set(CacheKeys.DASHBOARD_STATS_BY_TYPE, result, ttl=60)
    
    return result


@router.get("/stats/by-client", summary="Get Top Clients by Deadline Count")
async def get_stats_by_client(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get top 10 clients by number of active deadlines"""
    # Try cache
    cached = cache.get(CacheKeys.DASHBOARD_STATS_BY_CLIENT)
    if cached:
        return cached
    
    today = date.today()
    urgent_threshold = today + timedelta(days=14)
    
    stats = db.query(
        User.company_name,
        User.full_name,
        func.count(Deadline.id).label('deadline_count'),
        func.sum(case((Deadline.expiration_date < urgent_threshold, 1), else_=0)).label('urgent_count')
    ).join(Deadline)     .filter(User.role == 'client', User.is_active == True, Deadline.status == 'active')     .group_by(User.id, User.company_name, User.full_name)     .order_by(func.count(Deadline.id).desc())     .limit(10)     .all()
    
    result = []
    for stat in stats:
        display_name = stat.company_name if stat.company_name else stat.full_name
        result.append({
            'client_name': display_name,
            'deadline_count': stat.deadline_count or 0,
            'urgent_count': int(stat.urgent_count or 0)
        })
    
    # Cache for 60 seconds
    cache.set(CacheKeys.DASHBOARD_STATS_BY_CLIENT, result, ttl=60)
    
    return result


# ============================================
# Cache Invalidation Helper
# ============================================

def invalidate_dashboard_cache():
    """Invalidate all dashboard-related cache keys"""
    cache.delete(CacheKeys.DASHBOARD_SUMMARY)
    cache.delete(CacheKeys.DASHBOARD_STATS_BY_TYPE)
    cache.delete(CacheKeys.DASHBOARD_STATS_BY_CLIENT)
    cache.delete_pattern('deadlines:*')
