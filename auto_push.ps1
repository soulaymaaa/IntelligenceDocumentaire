# Script d'auto-push automatique pour GitHub
# Ce script vérifie s'il y a des changements toutes les 15 secondes et les envoie sur GitHub.

Write-Host "=== Script d'Auto-Push activé ===" -ForegroundColor Green
Write-Host "Appuyez sur Ctrl+C pour arrêter la synchronisation." -ForegroundColor Yellow

while ($true) {
    # Vérifie s'il y a des modifications non validées ou non suivies
    $status = git status --porcelain
    if ($status) {
        Write-Host ""
        Write-Host "--- Changements detectes ($(Get-Date -Format 'HH:mm:ss')) ---" -ForegroundColor Cyan
        
        # Affiche les fichiers modifiés
        Write-Host $status
        
        # Ajoute tous les changements
        git add .
        
        # Crée un commit avec la date et l'heure actuelles
        $commitMessage = "Mise a jour automatique : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git commit -m $commitMessage
        
        # Envoie les modifications sur GitHub
        Write-Host "Envoi vers GitHub (origin main)..." -ForegroundColor Magenta
        git push origin main
        
        Write-Host "Synchronisation terminee !" -ForegroundColor Green
    }
    
    # Attend 15 secondes avant la prochaine vérification
    Start-Sleep -Seconds 15
}
